import logger from '../utils/logger';

export class CashfreeService {
    private clientId: string;
    private clientSecret: string;
    private baseUrl: string;

    constructor() {
        this.clientId = process.env.CASHFREE_CLIENT_ID || '';
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET || '';
        const env = process.env.CASHFREE_ENV || 'sandbox';

        // Base URL for Verification Suite
        this.baseUrl = env === 'production'
            ? 'https://api.cashfree.com/verification'
            : 'https://sandbox.cashfree.com/verification';
    }

    private getHeaders() {
        return {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Generate a KYC Link for a partner
     * @param verificationId Unique ID for this request (usually partner ID + timestamp)
     * @param phone Partner's phone number
     * @param name Partner's name
     * @param email Partner's email
     */
    async generateKYCLink(verificationId: string, phone: string, name?: string, email?: string) {
        try {
            const body = {
                verification_id: verificationId,
                phone: phone,
                name: name,
                email: email,
                template_name: 'Standard_KYC', // Default template, can be customized in dashboard
                notification_types: ['sms']
            };

            logger.info(`Cashfree: Generating KYC link for ${phone} (ID: ${verificationId})`);

            const response = await fetch(`${this.baseUrl}/kyc/link`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });

            const data = await response.json() as any;
            logger.info('Cashfree KYC Link Response:', data);

            if (response.ok) {
                return {
                    success: true,
                    data: data, // contains form_link
                    message: 'KYC link generated successfully'
                };
            } else {
                return {
                    success: false,
                    message: data.message || 'Failed to generate KYC link',
                    error: data
                };
            }
        } catch (error: any) {
            logger.error('Cashfree KYC Link Error:', error);
            return {
                success: false,
                message: error.message || 'External service error',
                error: error
            };
        }
    }

    /**
     * Get status of a KYC verification link
     * @param verificationId The ID used to generate the link
     */
    async getKYCStatus(verificationId: string) {
        try {
            logger.info(`Cashfree: Fetching status for ${verificationId}`);

            const response = await fetch(`${this.baseUrl}/kyc/link/${verificationId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json() as any;
            logger.info('Cashfree KYC Status:', data);

            if (response.ok) {
                return {
                    success: true,
                    status: data.status, // ACTIVE, COMPLETED, EXPIRED, DEACTIVATED
                    data: data
                };
            } else {
                return {
                    success: false,
                    message: data.message || 'Failed to fetch status',
                    error: data
                };
            }
        } catch (error: any) {
            logger.error('Cashfree Status Error:', error);
            return { success: false, message: error.message };
        }
    }
}
