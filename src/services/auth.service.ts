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
        const otp = generateOTP(6);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create user and partner in transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: email || `${phoneNumber}@snearal.com`, // Fallback for phone-only
                    password: hashedPassword,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    role: role || 'CUSTOMER',
                    email_verified: false,
                    phone_verified: false,
                    verification_otp: otp,
                    otp_expires_at: otpExpiry,
                },
            });

            if (role === 'SERVICE_PARTNER') {
                await tx.servicePartner.create({
                    data: {
                        user_id: user.id,
                        category_id: categoryId,
                        availability_status: 'OFFLINE',
                        kyc_status: 'PENDING',
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
            const otp = generateOTP(6);
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    verification_otp: otp,
                    otp_expires_at: otpExpiry,
                }
            });

            console.log(`Login OTP for ${identifier}: ${otp}`);
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

        if (user.email_verified || user.phone_verified) {
            // If already verified, just return success
            // return { message: 'Already verified' };
        }

        if (user.verification_otp !== otp || !user.otp_expires_at) {
            throw new BadRequestError('No verification OTP found. Please request a new one.');
        }

        if (user.verification_otp !== otp) {
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

        if (user.email_verified) {
            throw new BadRequestError('Email already verified');
        }

        // Generate new OTP
        const otp = generateOTP(6);
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
        const otp = generateOTP(6);
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

        return { message: 'If the email exists, a password reset code has been sent' };
    }

    async resetPassword(email: string, otp: string, newPassword: string) {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new BadRequestError('User not found');
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

            // Check if token exists in Redis
            const storedToken = await getRedisValue(`refresh_token:${decoded.userId}`);
            if (storedToken !== refreshToken) {
                throw new UnauthorizedError('Invalid refresh token');
            }

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
            });

            if (!user) {
                throw new UnauthorizedError('User not found');
            }

            // Generate new access token
            const newAccessToken = generateAccessToken({
                userId: user.id,
                role: user.role,
                email: user.email,
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
                service_partner: true,
                business_partner: true,
            },
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        const u = user as any;
        const { password: _password, verification_otp: _verification_otp, otp_expires_at: _otp_expires_at, reset_otp: _reset_otp, ...userWithoutSensitive } = u;

        return userWithoutSensitive;
    }

    async updateProfile(userId: string, data: any) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestError('User not found');
        }

        // Update user
        await prisma.user.update({
            where: { id: userId },
            data: {
                full_name: data.fullName || user.full_name,
                phone_number: data.phoneNumber || user.phone_number,
            },
        });

        // Update or create profile
        if (data.address || data.city || data.state || data.bio) {
            await prisma.profile.upsert({
                where: { user_id: userId },
                update: {
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    postal_code: data.postalCode,
                    avatar_url: data.avatarUrl,
                    bio: data.bio,
                },
                create: {
                    user_id: userId,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    postal_code: data.postalCode,
                    avatar_url: data.avatarUrl,
                    bio: data.bio,
                },
            });
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
