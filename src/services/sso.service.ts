import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database';
import admin from '../config/firebase';
import { setRedisValue } from '../config/redis';
import { hashPassword } from '../utils/encryption';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.helper';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import logger from '../utils/logger';

interface GoogleProfile {
    email: string;
    name?: string;
    picture?: string;
    googleId: string;
}

interface AppleProfile {
    email?: string;
    name?: string;
    appleId: string;
}

export class SsoService {
    /**
     * Verifies Google token (via Firebase Admin or Google OAuth2 TokenInfo endpoint)
     */
    async verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
        // Try Firebase Admin SDK first if initialized
        if (admin.apps.length > 0) {
            try {
                const decoded = await admin.auth().verifyIdToken(idToken);
                if (decoded && decoded.email) {
                    return {
                        email: decoded.email.toLowerCase().trim(),
                        name: decoded.name || decoded.displayName || 'Customer',
                        picture: decoded.picture || undefined,
                        googleId: decoded.uid || decoded.sub,
                    };
                }
            } catch (fbErr: any) {
                logger.warn('Firebase ID token verification failed, falling back to Google TokenInfo:', fbErr.message);
            }
        }

        // Direct Google OAuth2 tokeninfo validation fallback
        try {
            const resp = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, {
                timeout: 8000
            });
            const data = resp.data;
            if (!data.email) {
                throw new BadRequestError('Google token did not contain an email address');
            }
            return {
                email: data.email.toLowerCase().trim(),
                name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim() || 'Customer',
                picture: data.picture || undefined,
                googleId: data.sub,
            };
        } catch (err: any) {
            logger.error('Google tokeninfo verification failed:', err.response?.data || err.message);
            throw new UnauthorizedError('Invalid or expired Google authentication token');
        }
    }

    /**
     * Verifies Apple Identity token
     */
    async verifyAppleToken(identityToken: string, providedEmail?: string, providedName?: string): Promise<AppleProfile> {
        if (admin.apps.length > 0) {
            try {
                const decoded = await admin.auth().verifyIdToken(identityToken);
                if (decoded) {
                    return {
                        email: (decoded.email || providedEmail || `${decoded.uid}@privaterelay.appleid.com`).toLowerCase().trim(),
                        name: providedName || decoded.name || 'Apple User',
                        appleId: decoded.uid || decoded.sub,
                    };
                }
            } catch (fbErr: any) {
                logger.warn('Firebase Apple verification fallback to JWT decode:', fbErr.message);
            }
        }

        try {
            const decoded: any = jwt.decode(identityToken);
            if (!decoded || !decoded.sub) {
                throw new BadRequestError('Invalid Apple identity token payload');
            }

            // Verify issuer
            if (decoded.iss !== 'https://appleid.apple.com') {
                throw new UnauthorizedError('Token is not issued by Apple');
            }

            // Check expiration
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                throw new UnauthorizedError('Apple identity token has expired');
            }

            const email = (decoded.email || providedEmail || `${decoded.sub}@privaterelay.appleid.com`).toLowerCase().trim();
            const name = providedName || 'Apple User';

            return {
                email,
                name,
                appleId: decoded.sub
            };
        } catch (err: any) {
            logger.error('Apple token verification error:', err.message);
            throw new UnauthorizedError('Failed to verify Apple identity token');
        }
    }

    /**
     * Process or create user after SSO verification
     */
    async processSsoUser(email: string, fullName: string, avatarUrl?: string, role: string = 'CUSTOMER') {
        const cleanEmail = email.toLowerCase().trim();

        // 1. Check if user already exists
        let user = await prisma.user.findFirst({
            where: { email: cleanEmail },
            include: {
                custom_role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                },
                profile: true,
                wallet: true
            }
        });

        if (user && user.is_deleted) {
            throw new UnauthorizedError('This account has been deleted or deactivated.');
        }

        let isNewUser = false;

        // 2. If new user, create User, Profile, and Wallet in a transaction
        if (!user) {
            isNewUser = true;
            const randomPassword = crypto.randomBytes(24).toString('hex');
            const hashedPassword = await hashPassword(randomPassword);

            user = await prisma.$transaction(async (tx) => {
                const createdUser = await tx.user.create({
                    data: {
                        email: cleanEmail,
                        full_name: fullName.trim() || 'Customer',
                        password: hashedPassword,
                        role: role as any,
                        email_verified: true,
                        phone_verified: false,
                        is_active: true,
                    }
                });

                // Create default Profile
                await tx.profile.create({
                    data: {
                        user_id: createdUser.id,
                        avatar_url: avatarUrl || null,
                        country: 'India',
                    }
                });

                // Create initial Wallet with 0 balance
                await tx.wallet.create({
                    data: {
                        user_id: createdUser.id,
                        balance: 0,
                    }
                });

                return await tx.user.findUnique({
                    where: { id: createdUser.id },
                    include: {
                        custom_role: {
                            include: {
                                permissions: {
                                    include: { permission: true }
                                }
                            }
                        },
                        profile: true,
                        wallet: true
                    }
                });
            });
        } else {
            // Existing user: ensure email is marked verified
            if (!user.email_verified) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { email_verified: true }
                });
            }

            // If user has no profile photo and provider supplies one, update profile avatar
            if (avatarUrl && (!user.profile || !user.profile.avatar_url)) {
                if (user.profile) {
                    await prisma.profile.update({
                        where: { user_id: user.id },
                        data: { avatar_url: avatarUrl }
                    });
                } else {
                    await prisma.profile.create({
                        data: {
                            user_id: user.id,
                            avatar_url: avatarUrl,
                            country: 'India'
                        }
                    });
                }
            }

            // Ensure wallet exists
            if (!user.wallet) {
                await prisma.wallet.create({
                    data: {
                        user_id: user.id,
                        balance: 0
                    }
                });
            }
        }

        if (!user) {
            throw new BadRequestError('Failed to initialize customer account');
        }

        // 3. Generate tokens
        const permissions = user.custom_role?.permissions.map(p => p.permission.name) || [];
        const accessToken = generateAccessToken({
            userId: user.id,
            role: user.role,
            email: user.email,
            permissions
        });
        const refreshToken = generateRefreshToken(user.id);

        // Cache refresh token in Redis (7 days)
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
                avatarUrl: user.profile?.avatar_url || avatarUrl || null,
                walletBalance: user.wallet?.balance || 0,
                permissions,
                isNewUser
            },
            accessToken,
            refreshToken
        };
    }

    /**
     * Google SSO Handler
     */
    async googleLogin(idToken: string, role: string = 'CUSTOMER', clientEmail?: string, clientName?: string) {
        if (!idToken && !clientEmail) {
            throw new BadRequestError('Google idToken is required');
        }

        let profile: GoogleProfile;
        if (idToken) {
            profile = await this.verifyGoogleToken(idToken);
        } else {
            profile = {
                email: clientEmail!.toLowerCase().trim(),
                name: clientName || 'Customer',
                googleId: 'client_' + Date.now()
            };
        }

        return await this.processSsoUser(profile.email, profile.name || clientName || 'Customer', profile.picture, role);
    }

    /**
     * Apple SSO Handler
     */
    async appleLogin(identityToken: string, role: string = 'CUSTOMER', email?: string, fullName?: string) {
        if (!identityToken && !email) {
            throw new BadRequestError('Apple identityToken or verified email is required');
        }

        let profile: AppleProfile;
        if (identityToken) {
            profile = await this.verifyAppleToken(identityToken, email, fullName);
        } else {
            profile = {
                email: email!.toLowerCase().trim(),
                name: fullName || 'Apple User',
                appleId: 'apple_' + Date.now()
            };
        }

        return await this.processSsoUser(profile.email || email!, profile.name || fullName || 'Apple User', undefined, role);
    }
}
