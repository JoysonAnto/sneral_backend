import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { successResponse } from '../utils/response';
import { NotFoundError, BadRequestError } from '../utils/errors';

/**
 * GDPR Compliance Controller
 * Handles user data export, deletion, and consent management
 */

// Export user data (GDPR Right to Access & Portability)
export const exportUserData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            throw new NotFoundError('User not found');
        }

        // Fetch all user data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                business_partner: {
                    include: {
                        bookings: true,
                        kyc_documents: true,
                    },
                },
                service_partner: {
                    include: {
                        bookings: true,
                        partner_services: true,
                        kyc_documents: true,
                        ratings: true,
                    },
                },
                wallet: {
                    include: {
                        transactions: true,
                    },
                },
                sent_messages: true,
                received_messages: true,
                notifications: true,
                conversations_as_user1: true,
                conversations_as_user2: true,
            } as any,
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Remove sensitive fields
        const { password: _password, verification_otp: _verification_otp, reset_otp: _reset_otp, ...userData } = user as any;

        const exportData = {
            exported_at: new Date().toISOString(),
            data_subject: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone_number: user.phone_number,
            },
            personal_data: userData,
            metadata: {
                account_created: user.created_at,
                last_updated: user.updated_at,
                email_verified: user.email_verified,
                phone_verified: user.phone_verified,
            },
        };

        res.json(successResponse(exportData, 'User data exported successfully'));
    } catch (error) {
        next(error);
    }
};

// Request account deletion (GDPR Right to Erasure / Account Management)
export const requestDataDeletion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const { reason, password } = req.body;

        if (!userId) {
            throw new NotFoundError('User not found');
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Identity verification: If user has a password and provided one, verify it
        if (password && user.password) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                throw new BadRequestError('Incorrect password. Account deletion verification failed.');
            }
        }

        // Safety check: Prevent deletion if active or in-progress bookings exist
        const activeBookings = await prisma.booking.findMany({
            where: {
                customer_id: userId,
                status: {
                    in: ['PENDING', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_ACCEPTED', 'IN_PROGRESS', 'PARTNER_ARRIVED', 'ARRIVED', 'PENDING_ASSIGNMENT']
                }
            }
        });

        if (activeBookings.length > 0) {
            throw new BadRequestError('Cannot delete account while you have active or ongoing bookings. Please complete or cancel them before proceeding.');
        }

        // Check wallet balance
        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId }
        });
        const walletBalance = Number(wallet?.balance || 0);

        // Soft delete & anonymize user for compliance and safety
        await prisma.user.update({
            where: { id: userId },
            data: {
                is_deleted: true,
                is_active: false,
                deleted_at: new Date(),
                email: `deleted_${userId}@anonymized.snearal`,
                phone_number: null,
                full_name: 'Deleted Customer',
            },
        });

        // Log deletion request for audit
        await prisma.auditLog.create({
            data: {
                user_id: userId,
                action: 'DATA_DELETION_REQUESTED',
                details: {
                    reason: reason || 'Customer requested account deletion',
                    wallet_balance_at_deletion: walletBalance,
                    requested_at: new Date()
                },
                ip_address: req.ip,
            },
        });

        res.json(successResponse(
            {
                deleted: true,
                deletion_scheduled: true,
                wallet_balance: walletBalance,
                deletion_date: new Date()
            },
            'Your account has been deleted successfully.'
        ));
    } catch (error) {
        next(error);
    }
};

// Update consent preferences
export const updateConsent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const { marketing_consent, data_processing_consent, cookie_consent } = req.body;

        if (!userId) {
            throw new NotFoundError('User not found');
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                marketing_consent: marketing_consent ?? undefined,
                data_processing_consent: data_processing_consent ?? undefined,
                cookie_consent: cookie_consent ?? undefined,
                consent_updated_at: new Date(),
            },
        });

        // Log consent change
        await prisma.auditLog.create({
            data: {
                user_id: userId,
                action: 'CONSENT_UPDATED',
                details: { marketing_consent, data_processing_consent, cookie_consent },
                ip_address: req.ip,
            },
        });

        res.json(successResponse(
            {
                marketing_consent: user.marketing_consent,
                data_processing_consent: user.data_processing_consent,
                cookie_consent: user.cookie_consent,
            },
            'Consent preferences updated'
        ));
    } catch (error) {
        next(error);
    }
};

// Get user consent status
export const getConsent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            throw new NotFoundError('User not found');
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                marketing_consent: true,
                data_processing_consent: true,
                cookie_consent: true,
                consent_updated_at: true,
            },
        });

        res.json(successResponse(user, 'Consent preferences retrieved'));
    } catch (error) {
        next(error);
    }
};

// Download data as JSON file
export const downloadUserData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            throw new NotFoundError('User not found');
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                business_partner: {
                    include: {
                        bookings: true,
                    },
                },
                service_partner: {
                    include: {
                        bookings: true,
                        partner_services: true,
                    },
                },
                wallet: {
                    include: {
                        transactions: true,
                    },
                },
            } as any,
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const { password: _password, verification_otp: _verification_otp, reset_otp: _reset_otp, ...userData } = user as any;

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.json"`);
        res.send(JSON.stringify(userData, null, 2));
    } catch (error) {
        next(error);
    }
};
