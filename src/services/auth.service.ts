import prisma from '../config/database';
import { setRedisValue, getRedisValue, deleteRedisValue } from '../config/redis';
import { hashPassword, comparePassword, generateOTP } from '../utils/encryption';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.helper';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { EmailService } from './email.service';

interface RegisterData {
    email?: string;
    password?: string;
    fullName: string;
    phoneNumber?: string;
    role?: 'CUSTOMER' | 'SERVICE_PARTNER' | 'BUSINESS_PARTNER';
    categoryId?: string;
    businessName?: string;
    businessType?: string;
    referralCode?: string;
}

export class AuthService {
    private emailService: EmailService;

    constructor() {
        this.emailService = new EmailService();
    }

    async register(data: RegisterData) {
        const { email, password, fullName, phoneNumber, role, categoryId, businessName, businessType } = data;

        // Check if user already exists
        if (email) {
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });
            if (existingUser) {
                throw new BadRequestError('Email already registered');
            }
        }

        if (phoneNumber) {
            const existingUser = await prisma.user.findFirst({
                where: { phone_number: phoneNumber },
            });
            if (existingUser) {
                throw new BadRequestError('Phone number already registered');
            }
        }

        // Hash password (generate random one if not provided for OTP flow)
        const userPassword = password || Math.random().toString(36).slice(-10);
        const hashedPassword = await hashPassword(userPassword);

        // Generate OTP for verification
        const otp = generateOTP(4);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const namePrefix = (fullName || (role === 'SERVICE_PARTNER' ? 'PRO' : 'USER')).replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
        const userReferralCode = `SN-${namePrefix || (role === 'SERVICE_PARTNER' ? 'PRO' : 'CUST')}-${randomDigits}`;

        // Create user and partner in transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: email || `${phoneNumber}@snearal.com`, // Fallback for phone-only
                    password: hashedPassword,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    role: role || 'CUSTOMER',
                    referral_code: userReferralCode,
                    email_verified: false,
                    phone_verified: false,
                    verification_otp: otp,
                    otp_expires_at: otpExpiry,
                },
            });

            // Create initial wallet
            await tx.wallet.create({
                data: {
                    user_id: user.id,
                    balance: 0,
                }
            });

            // If referral code supplied, link referral tracking
            if (data.referralCode) {
                const cleanCode = data.referralCode.trim();
                let referrer = await tx.user.findFirst({
                    where: { referral_code: cleanCode, is_deleted: false }
                });
                if (!referrer) {
                    const sp = await tx.servicePartner.findFirst({
                        where: { referral_code: cleanCode },
                        include: { user: true }
                    });
                    if (sp && sp.user && !sp.user.is_deleted) {
                        referrer = sp.user;
                    }
                }

                if (referrer && referrer.id !== user.id) {
                    const isRefereePartner = role === 'SERVICE_PARTNER';
                    const isReferrerPartner = referrer.role === 'SERVICE_PARTNER';
                    let refType = 'CUSTOMER_TO_CUSTOMER';
                    let target = 5;
                    let referrerReward = 200;

                    if (isRefereePartner && isReferrerPartner) {
                        refType = 'PARTNER_TO_PARTNER';
                        target = 30; // 30 completed orders (or 30 days working with 10 completed jobs)
                        referrerReward = 1500;
                    } else if (!isRefereePartner && isReferrerPartner) {
                        refType = 'PARTNER_TO_CUSTOMER';
                        target = 5;
                        referrerReward = 200;
                    }

                    await tx.referralTracking.create({
                        data: {
                            referrer_user_id: referrer.id,
                            referee_user_id: user.id,
                            referral_type: refType as any,
                            referral_code: cleanCode,
                            status: 'PENDING',
                            referrer_reward: referrerReward,
                            referee_reward: 100,
                            qualification_target: target,
                            qualifying_count: 0
                        }
                    });
                }
            }

            if (role === 'SERVICE_PARTNER') {
                await tx.servicePartner.create({
                    data: {
                        user_id: user.id,
                        category_id: categoryId,
                        availability_status: 'OFFLINE',
                        kyc_status: 'PENDING',
                        referral_code: user.referral_code || userReferralCode,
                        referred_by_code: data.referralCode || null,
                    }
                });
            } else if (role === 'BUSINESS_PARTNER') {
                await tx.businessPartner.create({
                    data: {
                        user_id: user.id,
                        business_name: businessName || fullName,
                        business_type: businessType || 'Other',
                        category_id: categoryId,
                        kyc_status: 'PENDING',
                    }
                });
            }

            return user;
        });

        // Send verification email if email exists
        if (email) {
            await this.emailService.sendVerificationEmail(email, otp, fullName);
        }
        // In a real scenario, we'd send SMS here for phoneNumber
        console.log(`Verification OTP for ${email || phoneNumber}: ${otp}`);

        return {
            userId: result.id,
            email: result.email,
            phoneNumber: result.phone_number,
            role: result.role,
            message: 'Registration successful. Please verify with the OTP sent to you.',
            otp, // Included for development/testing
        };
    }

    async login(identifier: string, password?: string) {
        // Find user
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone_number: identifier }
                ]
            },
        });

        if (!user) {
            console.log(`[AUTH DEBUG] User not found for identifier: ${identifier}`);
            throw new UnauthorizedError('Invalid credentials');
        }

        if (user.is_deleted) {
            throw new UnauthorizedError('This account has been deleted or deactivated.');
        }

        if (password) {
            // Check if email is verified
            if (!user.email_verified && user.email) {
                // throw new UnauthorizedError('Please verify your email first');
            }

            // Verify password
            console.log(`[AUTH DEBUG] Comparing password for user: ${user.email}`);
            console.log(`[AUTH DEBUG] Provided password: ${password}`);
            console.log(`[AUTH DEBUG] Hashed password in DB: ${user.password}`);
            const isValidPassword = await comparePassword(password, user.password);
            console.log(`[AUTH DEBUG] Is valid password? ${isValidPassword}`);

            if (!isValidPassword) {
                console.log(`[AUTH DEBUG] Login failed: Invalid password for ${identifier}`);
                throw new UnauthorizedError('Invalid credentials');
            }

            // Fetch permissions if dynamic role exists
            const userWithPermissions = await prisma.user.findUnique({
                where: { id: user.id },
                include: {
                    custom_role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true
                                }
                            }
                        }
                    }
                }
            });

            const permissions = userWithPermissions?.custom_role?.permissions.map(p => p.permission.name) || [];

            // Generate tokens
            const accessToken = generateAccessToken({
                userId: user.id,
                role: user.role,
                email: user.email,
                permissions,
            });
            const refreshToken = generateRefreshToken(user.id);

            // Store refresh token in Redis with 7 days expiry
            await setRedisValue(
                `refresh_token:${user.id}`,
                refreshToken,
                7 * 24 * 60 * 60
            );

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    phoneNumber: user.phone_number,
                },
                accessToken,
                refreshToken,
            };
        } else {
            // OTP login
            const otp = generateOTP(4);
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    verification_otp: otp,
                    otp_expires_at: otpExpiry,
                }
            });

            console.log(`Login OTP for ${identifier}: ${otp}`);

            if (user.email) {
                await this.emailService.sendLoginOTPEmail(user.email, otp, user.full_name);
            }

            return {
                message: 'OTP sent successfully. Please verify to login.',
                otp, // dev only
            };
        }
    }

    async verifyEmail(email: string, otp: string) {
        return this.verifyOtp(email, otp);
    }

    async verifyOtp(identifier: string, otp: string) {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone_number: identifier }
                ]
            },
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        if (user.is_deleted) {
            throw new BadRequestError('This account has been deleted or deactivated.');
        }

        if (user.email_verified || user.phone_verified) {
            // If already verified, just return success
            // return { message: 'Already verified' };
        }

        if (!user.verification_otp || !user.otp_expires_at) {
            throw new BadRequestError('No verification OTP found. Please request a new one.');
        }

        if (user.verification_otp !== otp.toString()) {
            throw new BadRequestError('Invalid OTP');
        }

        if (new Date() > new Date(user.otp_expires_at)) {
            throw new BadRequestError('OTP has expired. Please request a new one.');
        }

        // Update user as verified
        await prisma.user.update({
            where: { id: user.id },
            data: {
                email_verified: true,
                phone_verified: true,
                verification_otp: null,
                otp_expires_at: null,
            },
        });

        // Fetch permissions if dynamic role exists
        const userWithPermissions = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                custom_role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });

        const permissions = userWithPermissions?.custom_role?.permissions.map(p => p.permission.name) || [];

        // Generate tokens since OTP verification is often the final step of login/register in mobile apps
        const accessToken = generateAccessToken({
            userId: user.id,
            role: user.role,
            email: user.email,
            permissions,
        });
        const refreshToken = generateRefreshToken(user.id);

        await setRedisValue(
            `refresh_token:${user.id}`,
            refreshToken,
            7 * 24 * 60 * 60
        );

        return {
            message: 'Verification successful',
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                phoneNumber: user.phone_number,
            }
        };
    }

    async resendVerificationOTP(email: string) {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        if (user.is_deleted) {
            throw new BadRequestError('This account has been deleted or deactivated.');
        }

        if (user.email_verified) {
            throw new BadRequestError('Email already verified');
        }

        // Generate new OTP
        const otp = generateOTP(4);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Update user with new OTP
        await prisma.user.update({
            where: { id: user.id },
            data: {
                verification_otp: otp,
                otp_expires_at: otpExpiry,
            },
        });

        // Send verification email
        await this.emailService.sendVerificationEmail(email, otp, user.full_name);
        console.log(`Resent Verification OTP for ${email}: ${otp}`);

        return { message: 'Verification code sent to your email' };
    }

    async forgotPassword(email: string) {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Don't reveal if user exists
            return { message: 'If the email exists, a password reset code has been sent' };
        }

        // Generate OTP for password reset
        const otp = generateOTP(4);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Update user with reset OTP
        await prisma.user.update({
            where: { id: user.id },
            data: {
                verification_otp: otp,
                otp_expires_at: otpExpiry,
            },
        });

        // Send password reset email
        await this.emailService.sendPasswordResetEmail(email, otp, user.full_name);
        console.log(`Password Reset OTP for ${email}: ${otp}`);

        return { message: 'If the email exists, a password reset code has been sent' };
    }

    async resetPassword(email: string, otp: string, newPassword: string) {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        if (user.is_deleted) {
            throw new BadRequestError('This account has been deleted or deactivated.');
        }

        if (user.verification_otp !== otp || !user.otp_expires_at) {
            throw new BadRequestError('No reset OTP found. Please request a new one.');
        }

        if (user.verification_otp !== otp) {
            throw new BadRequestError('Invalid OTP');
        }

        if (new Date() > new Date(user.otp_expires_at)) {
            throw new BadRequestError('OTP has expired. Please request a new one.');
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password and clear OTP
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                verification_otp: null,
                otp_expires_at: null,
            },
        });

        // Invalidate all refresh tokens
        await deleteRedisValue(`refresh_token:${user.id}`);

        return { message: 'Password reset successfully' };
    }

    async refreshToken(refreshToken: string) {
        try {
            const decoded = verifyRefreshToken(refreshToken);

            // Check if token exists in Redis (only if Redis is available and stored token is present)
            const storedToken = await getRedisValue(`refresh_token:${decoded.userId}`);
            if (storedToken && storedToken !== refreshToken) {
                throw new UnauthorizedError('Invalid refresh token');
            }

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
            });

            if (!user || user.is_deleted) {
                throw new UnauthorizedError('User not found or account deactivated');
            }

            // Fetch permissions for the new token
            const userWithPermissions = await prisma.user.findUnique({
                where: { id: user.id },
                include: {
                    custom_role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true
                                }
                            }
                        }
                    }
                }
            });

            const permissions = userWithPermissions?.custom_role?.permissions.map(p => p.permission.name) || [];

            // Generate new access token
            const newAccessToken = generateAccessToken({
                userId: user.id,
                role: user.role,
                email: user.email,
                permissions,
            });

            return { accessToken: newAccessToken };
        } catch (error) {
            throw new UnauthorizedError('Invalid or expired refresh token');
        }
    }

    async logout(userId: string) {
        // Remove refresh token from Redis
        await deleteRedisValue(`refresh_token:${userId}`);
        return { message: 'Logout successful' };
    }

    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                service_partner: {
                    include: { category: true, payout_methods: true }
                },
                business_partner: {
                    include: { category: true }
                },
                custom_role: true,
                wallet: true,
            },
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        if (user.is_deleted) {
            throw new BadRequestError('This account has been deleted or deactivated.');
        }

        // Calculate total earnings from transactions
        const earningsAggregate = await prisma.transaction.aggregate({
            where: {
                user_id: userId,
                type: 'BOOKING_PAYMENT',
                category: 'CREDIT',
                status: 'COMPLETED'
            },
            _sum: {
                amount: true
            }
        });
        const totalEarnings = earningsAggregate._sum.amount || 0;

        const u = user as any;
        const { password: _password, verification_otp: _verification_otp, otp_expires_at: _otp_expires_at, reset_otp: _reset_otp, ...userWithoutSensitive } = u;

        // Add profession/category name for dashboard
        if (user.role === 'SERVICE_PARTNER' && user.service_partner) {
            userWithoutSensitive.profession = (user.service_partner as any).category?.name || 'Partner';

            // Normalize service_partner object
            userWithoutSensitive.service_partner = {
                ...user.service_partner,
                total_earnings: totalEarnings,
                totalEarnings: totalEarnings,
                // Ensure consistency with PartnerService.getPartnerById
                kycStatus: user.service_partner.kyc_status,
                availabilityStatus: user.service_partner.availability_status,
                totalBookings: user.service_partner.total_bookings,
                completedBookings: user.service_partner.completed_bookings,
                avgRating: user.service_partner.avg_rating,
            };
        } else if (user.role === 'BUSINESS_PARTNER' && user.business_partner) {
            userWithoutSensitive.profession = (user.business_partner as any).category?.name || 'Business';

            // Normalize business_partner object
            userWithoutSensitive.business_partner = {
                ...user.business_partner,
                total_earnings: totalEarnings,
                totalEarnings: totalEarnings,
                kycStatus: user.business_partner.kyc_status,
                // total_bookings is not a direct field on BusinessPartner model, 
                // but we can provide it if needed by counting relations. 
                // For now, let's just match the structure.
            };
        }

        return userWithoutSensitive;
    }

    async updateProfile(userId: string, data: any) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true }
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        if (user.is_deleted) {
            throw new BadRequestError('This account has been deleted or deactivated.');
        }

        // Update user core credentials
        await prisma.user.update({
            where: { id: userId },
            data: {
                full_name: data.fullName || data.full_name || user.full_name,
                phone_number: data.phoneNumber || data.phone_number || user.phone_number,
            },
        });

        // Resolve address and location parameters
        const address = data.address || data.location || user.profile?.address;
        const city = data.city || user.profile?.city;
        const state = data.state || user.profile?.state;
        const postalCode = data.postalCode || data.postal_code || data.pincode || user.profile?.postal_code;
        const bio = data.bio !== undefined ? data.bio : user.profile?.bio;
        const avatarUrl = data.avatarUrl || data.avatar_url || data.profile_pic || user.profile?.avatar_url;

        // Upsert profile record
        await prisma.profile.upsert({
            where: { user_id: userId },
            update: {
                address,
                city,
                state,
                postal_code: postalCode,
                avatar_url: avatarUrl,
                bio,
            },
            create: {
                user_id: userId,
                address,
                city,
                state,
                postal_code: postalCode,
                avatar_url: avatarUrl,
                bio,
            },
        });

        // If user is a Service Partner, update their service partner competencies and preferences
        const sp = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });

        if (sp) {
            const spUpdateData: any = {};

            // Multi-skill categories
            let skillCategories = data.skillCategories || data.skill_categories;
            if (typeof skillCategories === 'string') {
                try {
                    skillCategories = JSON.parse(skillCategories);
                } catch {
                    skillCategories = skillCategories.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
            }

            if (Array.isArray(skillCategories) && skillCategories.length > 0) {
                spUpdateData.skill_categories = skillCategories;
                if (!sp.category_id && skillCategories[0]) {
                    spUpdateData.category_id = skillCategories[0];
                }
            }

            if (data.category_id || data.categoryId) {
                spUpdateData.category_id = data.category_id || data.categoryId;
            }

            // Destination mode / Go to Home
            if (data.destinationModeActive !== undefined || data.destination_mode_active !== undefined) {
                spUpdateData.destination_mode_active = Boolean(data.destinationModeActive ?? data.destination_mode_active);
            }
            if (data.homeAddress !== undefined || data.home_address !== undefined) {
                spUpdateData.home_address = data.homeAddress ?? data.home_address;
            }
            if (data.homeLatitude !== undefined || data.home_latitude !== undefined) {
                spUpdateData.home_latitude = Number(data.homeLatitude ?? data.home_latitude);
            }
            if (data.homeLongitude !== undefined || data.home_longitude !== undefined) {
                spUpdateData.home_longitude = Number(data.homeLongitude ?? data.home_longitude);
            }

            // Payout preferences
            if (data.autoTransferEnabled !== undefined || data.auto_transfer_enabled !== undefined) {
                spUpdateData.auto_transfer_enabled = Boolean(data.autoTransferEnabled ?? data.auto_transfer_enabled);
            }
            if (data.autoTransferSchedule || data.auto_transfer_schedule) {
                spUpdateData.auto_transfer_schedule = data.autoTransferSchedule || data.auto_transfer_schedule;
            }
            if (data.minimumPayoutThreshold !== undefined || data.minimum_payout_threshold !== undefined) {
                spUpdateData.minimum_payout_threshold = Number(data.minimumPayoutThreshold ?? data.minimum_payout_threshold);
            }

            // Generate referral code if missing
            if (!sp.referral_code) {
                const prefix = (user.full_name || 'PARTNER').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
                const randomPart = Math.floor(1000 + Math.random() * 9000);
                spUpdateData.referral_code = `SN-${prefix}-${randomPart}`;
            }

            if (Object.keys(spUpdateData).length > 0) {
                await prisma.servicePartner.update({
                    where: { id: sp.id },
                    data: spUpdateData
                });
            }

            // Automatically sync partner services for all selected skill categories
            if (Array.isArray(skillCategories) && skillCategories.length > 0) {
                try {
                    const servicesInCategories = await prisma.service.findMany({
                        where: {
                            category_id: { in: skillCategories },
                            is_active: true
                        },
                        select: { id: true }
                    });

                    for (const s of servicesInCategories) {
                        await prisma.partnerService.upsert({
                            where: {
                                service_id_partner_id: {
                                    service_id: s.id,
                                    partner_id: sp.id
                                }
                            },
                            update: { is_available: true },
                            create: {
                                service_id: s.id,
                                partner_id: sp.id,
                                is_available: true
                            }
                        }).catch(() => {});
                    }
                } catch (syncErr) {
                    console.error('Failed to auto-sync services for categories:', syncErr);
                }
            }
        }

        return this.getProfile(userId);
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        if (user.is_deleted) {
            throw new BadRequestError('This account has been deleted or deactivated.');
        }

        // Verify old password
        const isValidPassword = await comparePassword(oldPassword, user.password);
        if (!isValidPassword) {
            throw new BadRequestError('Current password is incorrect');
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        // Invalidate all refresh tokens for security
        await deleteRedisValue(`refresh_token:${userId}`);

        return { message: 'Password changed successfully. Please login again.' };
    }
}
