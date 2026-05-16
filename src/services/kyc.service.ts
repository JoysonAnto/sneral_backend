import prisma from '../config/database';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../utils/errors';
import fs from 'fs/promises';
import { AuditLogService } from './auditLog.service';
import { NotificationService } from './notification.service';
import { getIO } from '../socket/socket.server';
import { AdminService } from './admin.service';
import logger from '../utils/logger';

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
        console.log(`🔍 [DEBUG] Checking KYC status for PartnerID/UserID: ${partnerId}`);

        // Try both partner types by ID first
        let [servicePartner, businessPartner] = await Promise.all([
            prisma.servicePartner.findUnique({
                where: { id: partnerId },
                include: { user: true, kyc_documents: true },
            }),
            prisma.businessPartner.findUnique({
                where: { id: partnerId },
                include: { user: true, kyc_documents: true },
            }),
        ]);

        // If not found by ID, try searching by user_id (common frontend mistake)
        if (!servicePartner && !businessPartner) {
            console.log(`🔍 [DEBUG] Not found by ID, searching by UserID: ${partnerId}`);
            [servicePartner, businessPartner] = await Promise.all([
                prisma.servicePartner.findUnique({
                    where: { user_id: partnerId },
                    include: { user: true, kyc_documents: true },
                }),
                prisma.businessPartner.findUnique({
                    where: { user_id: partnerId },
                    include: { user: true, kyc_documents: true },
                }),
            ]);
        }

        const partner = servicePartner || businessPartner;

        if (!partner) {
            throw new NotFoundError('Partner profile not found');
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

    async getPendingKYCs(page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        logger.info(`[KYC] Fetching pending KYCs (page ${page}, limit ${limit})`);

        // 1. Fetch Service Partners in PENDING_VERIFICATION
        const servicePartners = await prisma.servicePartner.findMany({
            where: { kyc_status: 'PENDING_VERIFICATION' },
            include: { user: true, kyc_documents: true },
            orderBy: { updated_at: 'desc' }
        });

        // 2. Fetch Business Partners in PENDING_VERIFICATION
        const businessPartners = await prisma.businessPartner.findMany({
            where: { kyc_status: 'PENDING_VERIFICATION' },
            include: { user: true, kyc_documents: true },
            orderBy: { updated_at: 'desc' }
        });

        // 3. Map to flattened document-like structures for the frontend
        const flattenedDocs: any[] = [];

        const processPartner = (p: any, type: 'SERVICE_PARTNER' | 'BUSINESS_PARTNER') => {
            const partnerRole = type === 'SERVICE_PARTNER' ? 'SERVICE' : 'BUSINESS';
            
            if (p.kyc_documents && p.kyc_documents.length > 0) {
                p.kyc_documents.forEach((doc: any) => {
                    // Include pending documents
                    if (doc.status === 'PENDING_VERIFICATION') {
                        flattenedDocs.push({
                            id: doc.id,
                            doc_type: doc.document_type,
                            doc_number: doc.document_number || 'PENDING',
                            file_url: doc.document_url,
                            status: doc.status,
                            created_at: doc.created_at,
                            partner: {
                                id: p.id,
                                full_name: p.user?.full_name,
                                email: p.user?.email,
                                phone: p.user?.phone_number,
                                type: partnerRole
                            }
                        });
                    }
                });
            } else {
                // Return a placeholder for partners with no documents but pending status
                flattenedDocs.push({
                    id: `placeholder-${p.id}`,
                    doc_type: 'MISSING_DOCUMENTS',
                    doc_number: 'N/A',
                    file_url: '',
                    status: 'PENDING_VERIFICATION',
                    created_at: p.updated_at,
                    partner: {
                        id: p.id,
                        full_name: p.user?.full_name,
                        email: p.user?.email,
                        phone: p.user?.phone_number,
                        type: partnerRole
                    }
                });
            }
        };

        servicePartners.forEach(p => processPartner(p, 'SERVICE_PARTNER'));
        businessPartners.forEach(p => processPartner(p, 'BUSINESS_PARTNER'));

        // Sort by created_at desc
        flattenedDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Apply pagination
        const paginatedDocs = flattenedDocs.slice(skip, skip + limit);

        return {
            documents: paginatedDocs,
            total: flattenedDocs.length,
            page,
            limit
        };
    }

    async verifyKYCDocument(documentId: string, status: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED', reason?: string, adminId?: string) {
        const document = await prisma.kycDocument.findUnique({
            where: { id: documentId },
            include: {
                service_partner: true,
                business_partner: true
            }
        });

        if (!document) {
            throw new NotFoundError('KYC Document not found');
        }

        const partnerId = document.service_partner_id || document.business_partner_id;
        if (!partnerId) {
            throw new BadRequestError('Document is not associated with any partner');
        }

        // Use existing verifyKYC logic but targeted at this partner
        // The verifyKYC method already handles status updates for the partner and all their documents
        // Since the frontend seems to approve/reject on a per-document basis but our service is partner-level,
        // we'll apply it to the partner for now as that's the current system architecture.
        return await this.verifyKYC(partnerId, status, reason, adminId);
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

    async verifyEkoPan(userId: string, panNumber: string, fullName: string) {
        if (!panNumber || !fullName) {
            throw new BadRequestError('PAN number and full name are required');
        }

        // TODO: Integrate with Eko API
        // For now, mock a successful verification
        logger.info(`[Eko Integration] Verifying PAN: ${panNumber} for user ${userId}`);

        return {
            success: true,
            message: 'PAN verified successfully',
            data: {
                pan_number: panNumber,
                full_name: fullName,
                verification_id: `eko_pan_${Date.now()}`
            }
        };
    }

    async verifyEkoBank(userId: string, accountNumber: string, ifscCode: string) {
        if (!accountNumber || !ifscCode) {
            throw new BadRequestError('Account number and IFSC code are required');
        }

        // TODO: Integrate with Eko API (Penny Drop)
        // For now, mock a successful verification
        logger.info(`[Eko Integration] Verifying Bank: ${accountNumber} (IFSC: ${ifscCode}) for user ${userId}`);

        return {
            success: true,
            message: 'Bank verification successful (Penny Drop)',
            data: {
                account_number: accountNumber,
                ifsc_code: ifscCode,
                verification_id: `eko_bank_${Date.now()}`
            }
        };
    }
}
