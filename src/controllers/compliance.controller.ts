import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse } from '../utils/response';
import { NotFoundError } from '../utils/errors';

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

// Request account deletion (GDPR Right to Erasure)
export const requestDataDeletion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const { reason } = req.body;

        if (!userId) {
            throw new NotFoundError('User not found');
        }

        // Soft delete - mark for deletion
        await prisma.user.update({
            where: { id: userId },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                // Anonymize email for compliance
                email: `deleted_${userId}@anonymized.com`,
            },
        });

        // Log deletion request for audit
        await prisma.auditLog.create({
            data: {
                user_id: userId,
                action: 'DATA_DELETION_REQUESTED',
                details: { reason, requested_at: new Date() },
                ip_address: req.ip,
            },
        });

        res.json(successResponse(
            { deletion_scheduled: true, deletion_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
            'Account deletion scheduled. Your data will be permanently deleted in 30 days.'
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
