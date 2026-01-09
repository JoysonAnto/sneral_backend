import prisma from '../config/database';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../utils/errors';
import fs from 'fs/promises';
import { AuditLogService } from './auditLog.service';
import { NotificationService } from './notification.service';
import { getIO } from '../socket/socket.server';
import { AdminService } from './admin.service';

const broadcastStatsUpdate = async () => {
    try {
        const io = getIO();
        const adminService = new AdminService();
        const stats = await adminService.getDashboardStats();
        io.of('/admin').emit('dashboard:stats_update', stats);
    } catch (error) {
        // Socket not initialized or other error
    }
};

interface KYCDocuments {
    aadhaarFront?: string;
    aadhaarBack?: string;
    panCard?: string;
    photo?: string;
    bankProof?: string;
    businessLicense?: string;
    gstCertificate?: string;
}

export class KYCService {
    async submitKYC(userId: string, documents: KYCDocuments, userRole: string) {
        // Get partner record based on role
        let partnerId: string;
        let partnerType: 'SERVICE_PARTNER' | 'BUSINESS_PARTNER';

        if (userRole === 'SERVICE_PARTNER') {
            const partner = await prisma.servicePartner.findUnique({
                where: { user_id: userId },
            });

            if (!partner) {
                throw new NotFoundError('Service partner profile not found');
            }

            partnerId = partner.id;
            partnerType = 'SERVICE_PARTNER';
        } else if (userRole === 'BUSINESS_PARTNER') {
            const partner = await prisma.businessPartner.findUnique({
                where: { user_id: userId },
            });

            if (!partner) {
                throw new NotFoundError('Business partner profile not found');
            }

            partnerId = partner.id;
            partnerType = 'BUSINESS_PARTNER';
        } else {
            throw new BadRequestError('Only partners can submit KYC documents');
        }

        // Create KYC documents in database
        const kycDocs: any[] = [];
        const partner_field = partnerType === 'SERVICE_PARTNER' ? 'service_partner_id' : 'business_partner_id';

        const addDoc = (type: string, filename: string) => {
            kycDocs.push({
                [partner_field]: partnerId,
                document_type: type,
                document_url: `/uploads/kyc/${filename}`,
                status: 'PENDING_VERIFICATION',
            });
        };

        if (documents.aadhaarFront) addDoc('AADHAAR_FRONT', documents.aadhaarFront);
        if (documents.aadhaarBack) addDoc('AADHAAR_BACK', documents.aadhaarBack);
        if (documents.panCard) addDoc('PAN', documents.panCard);
        if (documents.photo) addDoc('PHOTO', documents.photo);
        if (documents.bankProof) addDoc('BANK_STATEMENT', documents.bankProof);
        if (documents.businessLicense && partnerType === 'BUSINESS_PARTNER') addDoc('BUSINESS_LICENSE', documents.businessLicense);
        if (documents.gstCertificate && partnerType === 'BUSINESS_PARTNER') addDoc('GST_CERTIFICATE', documents.gstCertificate);

        // Create documents and update partner KYC status
        await prisma.$transaction(async (tx) => {
            // Delete existing pending documents
            const whereDoc: any = { status: 'PENDING_VERIFICATION' };
            whereDoc[partner_field] = partnerId;

            await tx.kycDocument.deleteMany({
                where: whereDoc,
            });

            // Create new documents
            await tx.kycDocument.createMany({
                data: kycDocs,
            });

            // Update partner KYC status to pending verification
            if (partnerType === 'SERVICE_PARTNER') {
                await tx.servicePartner.update({
                    where: { id: partnerId },
                    data: { kyc_status: 'PENDING_VERIFICATION' },
                });
            } else {
                await tx.businessPartner.update({
                    where: { id: partnerId },
                    data: { kyc_status: 'PENDING_VERIFICATION' },
                });
            }
        });

        return {
            message: 'KYC documents submitted successfully',
            status: 'PENDING_VERIFICATION',
            documentsSubmitted: kycDocs.length,
        };
    }

    async getKYCStatus(partnerId: string, requesterId: string, requesterRole: string) {
        // Try both partner types
        const [servicePartner, businessPartner] = await Promise.all([
            prisma.servicePartner.findUnique({
                where: { id: partnerId },
                include: { user: true },
            }),
            prisma.businessPartner.findUnique({
                where: { id: partnerId },
                include: { user: true },
            }),
        ]);

        const partner = servicePartner || businessPartner;

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        // Check permissions
        const isOwnProfile = partner.user_id === requesterId;
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(requesterRole);

        if (!isOwnProfile && !isAdmin) {
            throw new UnauthorizedError('Access denied');
        }

        // Get KYC documents
        const whereDoc: any = {};
        whereDoc[servicePartner ? 'service_partner_id' : 'business_partner_id'] = partnerId;

        const documents = await prisma.kycDocument.findMany({
            where: whereDoc,
            orderBy: { created_at: 'desc' },
        });

        return {
            status: partner.kyc_status,
            verifiedAt: partner.kyc_verified_at,
            rejectionReason: (partner as any).kyc_rejection_reason,
            documents: documents.map(doc => ({
                id: doc.id,
                type: doc.document_type,
                url: doc.document_url,
                status: doc.status,
                uploadedAt: doc.created_at,
                verifiedAt: doc.verified_at,
            })),
        };
    }

    async verifyKYC(partnerId: string, status: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED', reason?: string, adminId?: string) {
        const notificationService = new NotificationService();
        // Try both partner types
        const [servicePartner, businessPartner] = await Promise.all([
            prisma.servicePartner.findUnique({
                where: { id: partnerId },
            }),
            prisma.businessPartner.findUnique({
                where: { id: partnerId },
            }),
        ]);

        const partner = servicePartner || businessPartner;
        const partnerType = servicePartner ? 'SERVICE_PARTNER' : 'BUSINESS_PARTNER';

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        // Update partner and documents
        await prisma.$transaction(async (tx) => {
            const updateBody: any = {
                kyc_status: status as any,
                kyc_rejection_reason: (status === 'REJECTED' || status === 'ACTION_REQUIRED') ? reason : null,
            };

            if (status === 'APPROVED') {
                updateBody.kyc_verified_at = new Date();
                updateBody.kyc_verified_by = adminId;
            }

            // Update partner KYC status
            if (partnerType === 'SERVICE_PARTNER') {
                await tx.servicePartner.update({
                    where: { id: partnerId },
                    data: updateBody,
                });
            } else {
                await tx.businessPartner.update({
                    where: { id: partnerId },
                    data: updateBody,
                });
            }

            // Update all documents
            const whereDoc: any = {};
            whereDoc[servicePartner ? 'service_partner_id' : 'business_partner_id'] = partnerId;

            await tx.kycDocument.updateMany({
                where: whereDoc,
                data: {
                    status: status as any,
                    verified_at: new Date(),
                    verified_by: adminId,
                },
            });
        });

        // Send notification to partner
        try {
            let notificationType = 'GENERAL';
            let title = 'KYC Update';
            let message = '';

            if (status === 'APPROVED') {
                notificationType = 'KYC_APPROVED';
                title = 'KYC Approved';
                message = 'Congratulations! Your KYC has been approved. You can now start accepting jobs.';
            } else if (status === 'REJECTED') {
                notificationType = 'KYC_REJECTED';
                title = 'KYC Rejected';
                message = `Your KYC has been rejected. Reason: ${reason}`;
            } else if (status === 'ACTION_REQUIRED') {
                notificationType = 'KYC_ACTION_REQUIRED';
                title = 'KYC Action Required';
                message = `Your KYC requires additional action. Please check your documents. Reason: ${reason}`;
            }

            await notificationService.createNotification(
                partner.user_id,
                notificationType as any,
                title,
                message,
                { partnerId, status, reason }
            );
        } catch (error) {
            console.error('Failed to send KYC notification:', error);
        }

        // Log admin action
        if (adminId) {
            await AuditLogService.logAdminAction(
                'VERIFY_KYC',
                adminId,
                partnerType,
                partnerId,
                undefined,
                { status, reason }
            );
        }

        // Broadcast stats update to admins
        broadcastStatsUpdate();

        return {
            message: `KYC ${status.toLowerCase().replace('_', ' ')} successfully`,
            status,
            partnerId,
        };
    }

    // Helper method to delete file
    async deleteDocument(documentId: string, partnerId: string, partnerType: 'SERVICE_PARTNER' | 'BUSINESS_PARTNER') {
        const where: any = { id: documentId };
        where[partnerType === 'SERVICE_PARTNER' ? 'service_partner_id' : 'business_partner_id'] = partnerId;

        const document = await prisma.kycDocument.findUnique({
            where,
        });

        if (!document) {
            throw new NotFoundError('Document not found');
        }

        // Delete file from filesystem
        try {
            const filePath = document.document_url.replace('/uploads/kyc/', '');
            await fs.unlink(`uploads/kyc/${filePath}`);
        } catch (error) {
            // File might not exist, continue
        }

        // Delete from database
        await prisma.kycDocument.delete({
            where: { id: documentId },
        });

        return { message: 'Document deleted successfully' };
    }
}
