import logger from '../utils/logger';
import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
import { NotificationService } from './notification.service';
import { AuditLogService } from './auditLog.service';

export class CashfreeService {
    private clientId: string;
    private clientSecret: string;
    private baseUrl: string;
    private pgBaseUrl: string;

    constructor() {
        this.clientId = process.env.CASHFREE_CLIENT_ID || '';
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET || '';
        const env = process.env.CASHFREE_ENV || 'sandbox';

        // Base URL for Verification Suite (KYC / PAN / Bank)
        this.baseUrl = env === 'production'
            ? 'https://api.cashfree.com/verification'
            : 'https://sandbox.cashfree.com/verification';

        // Base URL for Payment Gateway
        this.pgBaseUrl = env === 'production'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';
    }

    private getHeaders() {
        return {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'Content-Type': 'application/json'
        };
    }

    private getPGHeaders() {
        return {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'x-api-version': '2023-08-01',
            'Content-Type': 'application/json'
        };
    }

    // ─────────────────────────────────────────────────────────
    // KYC LINK (Verification Suite)
    // ─────────────────────────────────────────────────────────

    /**
     * Initiate Cashfree KYC for a Service Partner.
     * Generates a verification link and saves the verification_id on the partner record.
     */
    async initiatePartnerKYC(userId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: { user: true },
        });

        if (!partner) throw new NotFoundError('Service partner profile not found');

        // Reuse an existing active verification_id if present
        const verificationId = `snearal_sp_${partner.id}_${Date.now()}`;

        const phone = partner.user.phone_number || '';
        const name = partner.user.full_name;
        const email = partner.user.email;

        const result = await this.generateKYCLink(verificationId, phone, name, email);

        if (result.success) {
            // Persist the verification_id so webhook can resolve the partner
            await prisma.servicePartner.update({
                where: { id: partner.id },
                data: {
                    cashfree_kyc_verification_id: verificationId,
                    kyc_status: 'PENDING_VERIFICATION',
                },
            });
        }

        return { ...result, verification_id: verificationId };
    }

    /**
     * Generate a KYC Link for a partner
     */
    async generateKYCLink(verificationId: string, phone: string, name?: string, email?: string) {
        try {
            const body: any = {
                verification_id: verificationId,
                phone: phone,
                name: name,
                email: email,
                template_name: 'Standard_KYC',
                notification_types: ['sms'],
            };

            logger.info(`Cashfree: Generating KYC link for ${phone} (ID: ${verificationId})`);

            const response = await fetch(`${this.baseUrl}/kyc/link`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(body),
            });

            const data = await response.json() as any;
            logger.info('Cashfree KYC Link Response:', data);

            if (response.ok) {
                return { success: true, data, message: 'KYC link generated successfully' };
            } else {
                return { success: false, message: data.message || 'Failed to generate KYC link', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree KYC Link Error:', error);
            return { success: false, message: error.message || 'External service error', error };
        }
    }

    /**
     * Get status of a KYC verification link
     */
    async getKYCStatus(verificationId: string) {
        try {
            logger.info(`Cashfree: Fetching status for ${verificationId}`);

            const response = await fetch(`${this.baseUrl}/kyc/link/${verificationId}`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            const data = await response.json() as any;
            logger.info('Cashfree KYC Status:', data);

            if (response.ok) {
                return { success: true, status: data.status, data };
            } else {
                return { success: false, message: data.message || 'Failed to fetch status', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree Status Error:', error);
            return { success: false, message: error.message };
        }
    }

    // ─────────────────────────────────────────────────────────
    // INDIVIDUAL VERIFICATION APIs
    // ─────────────────────────────────────────────────────────

    /**
     * Verify PAN card via Cashfree Verification Suite
     */
    async verifyPAN(pan: string, name?: string) {
        try {
            const body: any = { pan };
            if (name) body.name = name;

            logger.info(`Cashfree: Verifying PAN ${pan}`);

            const response = await fetch(`${this.baseUrl}/pan`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(body),
            });

            const data = await response.json() as any;
            logger.info('Cashfree PAN Response:', data);

            if (response.ok) {
                return {
                    success: true,
                    verified: data.code === 200,
                    nameMatch: data.name_match_score,
                    data,
                    message: 'PAN verification completed',
                };
            } else {
                return { success: false, message: data.message || 'PAN verification failed', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree PAN Error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Verify Aadhaar (OTP-based) — Step 1: Generate OTP
     */
    async aadhaarGenerateOTP(aadhaarNumber: string) {
        try {
            logger.info(`Cashfree: Generating Aadhaar OTP`);

            const response = await fetch(`${this.baseUrl}/aadhaar/generate-otp`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ aadhaar_number: aadhaarNumber }),
            });

            const data = await response.json() as any;

            if (response.ok) {
                return { success: true, ref_id: data.ref_id, message: 'OTP sent to Aadhaar registered mobile' };
            } else {
                return { success: false, message: data.message || 'Failed to generate Aadhaar OTP', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree Aadhaar OTP Error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Verify Aadhaar (OTP-based) — Step 2: Submit OTP
     */
    async aadhaarVerifyOTP(refId: string, otp: string) {
        try {
            logger.info(`Cashfree: Verifying Aadhaar OTP for ref ${refId}`);

            const response = await fetch(`${this.baseUrl}/aadhaar/verify-otp`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ ref_id: refId, otp }),
            });

            const data = await response.json() as any;

            if (response.ok) {
                return {
                    success: true,
                    verified: data.code === 200,
                    aadhaar_data: data,
                    message: 'Aadhaar OTP verified successfully',
                };
            } else {
                return { success: false, message: data.message || 'Aadhaar OTP verification failed', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree Aadhaar Verify Error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Bank Account Verification via Penny Drop
     */
    async verifyBankAccount(accountNumber: string, ifsc: string, name?: string) {
        try {
            logger.info(`Cashfree: Bank verification for ${accountNumber}`);

            const body: any = {
                bank_account: accountNumber,
                ifsc,
            };
            if (name) body.name = name;

            const response = await fetch(`${this.baseUrl}/bank-account-comprehensive`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(body),
            });

            const data = await response.json() as any;
            logger.info('Cashfree Bank Verification Response:', data);

            if (response.ok) {
                return {
                    success: true,
                    verified: data.account_status === 'VALID',
                    account_name: data.name_at_bank,
                    account_status: data.account_status,
                    data,
                    message: 'Bank account verification completed',
                };
            } else {
                return { success: false, message: data.message || 'Bank verification failed', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree Bank Error:', error);
            return { success: false, message: error.message };
        }
    }

    // ─────────────────────────────────────────────────────────
    // WEBHOOK HANDLER
    // ─────────────────────────────────────────────────────────

    /**
     * Process incoming Cashfree KYC webhook events.
     * Cashfree sends a POST to /kyc/cashfree/webhook when a KYC link is completed.
     * 
     * Expected payload: { verification_id, status, data: { ...document_data } }
     */
    async handleKYCWebhook(payload: any) {
        const notificationService = new NotificationService();

        logger.info('Cashfree KYC Webhook received:', JSON.stringify(payload));

        const { verification_id, status } = payload;

        if (!verification_id) {
            logger.warn('Cashfree Webhook: missing verification_id');
            return { handled: false, reason: 'missing verification_id' };
        }

        // Find the partner by their cashfree_kyc_verification_id
        const partner = await prisma.servicePartner.findFirst({
            where: { cashfree_kyc_verification_id: verification_id },
            include: { user: true },
        });

        if (!partner) {
            logger.warn(`Cashfree Webhook: no partner found for verification_id ${verification_id}`);
            return { handled: false, reason: 'partner_not_found' };
        }

        // Map Cashfree statuses to internal KycStatus
        let newStatus: 'APPROVED' | 'REJECTED' | 'PENDING_VERIFICATION' = 'PENDING_VERIFICATION';
        let notifTitle = 'KYC Update';
        let notifMessage = '';

        if (status === 'COMPLETED') {
            newStatus = 'APPROVED';
            notifTitle = '✅ KYC Approved';
            notifMessage = 'Your KYC verification is complete! You can now start accepting jobs.';
        } else if (status === 'REJECTED' || status === 'DEACTIVATED') {
            newStatus = 'REJECTED';
            notifTitle = '❌ KYC Rejected';
            notifMessage = 'Your KYC verification was rejected. Please re-submit your documents.';
        } else if (status === 'ACTION_REQUIRED') {
            // Keep as pending but notify
            notifTitle = '⚠️ KYC Action Required';
            notifMessage = 'Your KYC verification requires additional action. Please complete the verification.';
        }

        // Update partner KYC status in DB
        await prisma.servicePartner.update({
            where: { id: partner.id },
            data: {
                kyc_status: newStatus,
                kyc_verified_at: newStatus === 'APPROVED' ? new Date() : undefined,
            },
        });

        // Send in-app notification
        try {
            await notificationService.createNotification(
                partner.user_id,
                newStatus === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
                notifTitle,
                notifMessage,
                { verification_id, cashfree_status: status, partner_id: partner.id }
            );
        } catch (err) {
            logger.error('Failed to send KYC webhook notification:', err);
        }

        // Audit log
        await AuditLogService.logAdminAction(
            'CASHFREE_KYC_WEBHOOK',
            'SYSTEM',
            'SERVICE_PARTNER',
            partner.id,
            undefined,
            { verification_id, cashfree_status: status, new_kyc_status: newStatus }
        );

        logger.info(`Cashfree Webhook: partner ${partner.id} KYC updated to ${newStatus}`);
        return { handled: true, partner_id: partner.id, new_status: newStatus };
    }

    // ─────────────────────────────────────────────────────────
    // PAYMENT GATEWAY
    // ─────────────────────────────────────────────────────────

    async createOrder(
        orderId: string,
        amount: number,
        customerId: string,
        customerPhone: string,
        customerName?: string,
        customerEmail?: string
    ) {
        try {
            const body = {
                order_id: orderId,
                order_amount: amount,
                order_currency: 'INR',
                customer_details: {
                    customer_id: customerId,
                    customer_phone: customerPhone,
                    customer_name: customerName || 'Customer',
                    customer_email: customerEmail || 'customer@example.com',
                },
                order_meta: {
                    return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/verify?order_id={order_id}`,
                },
            };

            logger.info(`Cashfree: Creating order ${orderId} for ${amount} INR`);

            const response = await fetch(`${this.pgBaseUrl}/orders`, {
                method: 'POST',
                headers: this.getPGHeaders(),
                body: JSON.stringify(body),
            });

            const data = await response.json() as any;

            if (response.ok) {
                return { success: true, data, message: 'Order created successfully' };
            } else {
                logger.error('Cashfree Order Creation Failed:', data);
                return { success: false, message: data.message || 'Failed to create order', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree Order Error:', error);
            return { success: false, message: error.message };
        }
    }

    async getOrderStatus(orderId: string) {
        try {
            const response = await fetch(`${this.pgBaseUrl}/orders/${orderId}`, {
                method: 'GET',
                headers: this.getPGHeaders(),
            });

            const data = await response.json() as any;

            if (response.ok) {
                return { success: true, status: data.order_status, data };
            } else {
                return { success: false, message: data.message || 'Failed to fetch order status', error: data };
            }
        } catch (error: any) {
            logger.error('Cashfree Status Error:', error);
            return { success: false, message: error.message };
        }
    }
}
