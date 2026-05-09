import { Request, Response, NextFunction } from 'express';
import { CashfreeService } from '../services/cashfree.service';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import prisma from '../config/database';

export class CashfreeController {
    private cashfreeService: CashfreeService;

    constructor() {
        this.cashfreeService = new CashfreeService();
    }

    // ─────────────────────────────────────────────────────────
    // KYC LINK - SELF-INITIATION (Service Partner)
    // ─────────────────────────────────────────────────────────

    /**
     * POST /kyc/cashfree/initiate
     * Service Partner calls this to start their Cashfree KYC.
     * Returns a form_link the partner opens in a browser/webview.
     */
    initiateKYC = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.cashfreeService.initiatePartnerKYC(req.user!.userId);

            if (result.success) {
                return res.json(successResponse(
                    {
                        kyc_link: (result.data as any)?.form_link || null,
                        verification_id: result.verification_id,
                        expires_at: (result.data as any)?.expiry_time || null,
                    },
                    'KYC link generated. Open the link to complete verification.'
                ));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: (result as any).error });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * GET /kyc/cashfree/status/me
     * Service Partner polls this to check if their Cashfree KYC is done.
     */
    getMyKYCStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await prisma.servicePartner.findUnique({
                where: { user_id: req.user!.userId },
                select: {
                    id: true,
                    kyc_status: true,
                    kyc_verified_at: true,
                    cashfree_kyc_verification_id: true,
                },
            });

            if (!partner) throw new BadRequestError('Service partner profile not found');

            // If there's an active verification, also poll Cashfree for live status
            let cashfreeStatus: any = null;
            if (partner.cashfree_kyc_verification_id) {
                const cf = await this.cashfreeService.getKYCStatus(partner.cashfree_kyc_verification_id);
                if (cf.success) {
                    cashfreeStatus = cf.data;
                }
            }

            return res.json(successResponse({
                kyc_status: partner.kyc_status,
                kyc_verified_at: partner.kyc_verified_at,
                verification_id: partner.cashfree_kyc_verification_id,
                cashfree_details: cashfreeStatus,
            }, 'KYC status retrieved'));
        } catch (error) {
            return next(error);
        }
    };

    // ─────────────────────────────────────────────────────────
    // MANUAL KYC LINK (Legacy / Admin override)
    // ─────────────────────────────────────────────────────────

    /**
     * POST /kyc/cashfree/generate-link
     * Generate a KYC link for any phone number (Admin / legacy use).
     */
    generateKYCLink = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { partnerId, phone, name, email } = req.body;

            if (!phone) throw new BadRequestError('Phone number is required');

            const verificationId = `snearal_${partnerId || 'anon'}_${Date.now()}`;
            const result = await this.cashfreeService.generateKYCLink(verificationId, phone, name, email);

            if (result.success) {
                return res.json(successResponse({ ...result.data, verification_id: verificationId }, result.message));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: result.error });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * GET /kyc/cashfree/status/:verificationId
     * Check status of any KYC link by verification ID.
     */
    getKYCStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { verificationId } = req.params;
            if (!verificationId) throw new BadRequestError('Verification ID is required');

            const result = await this.cashfreeService.getKYCStatus(verificationId);

            if (result.success) {
                return res.json(successResponse(result.data, 'KYC status retrieved'));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: result.error });
            }
        } catch (error) {
            return next(error);
        }
    };

    // ─────────────────────────────────────────────────────────
    // INDIVIDUAL VERIFICATIONS
    // ─────────────────────────────────────────────────────────

    /**
     * POST /kyc/cashfree/verify-pan
     * Instant PAN verification via Cashfree.
     */
    verifyPAN = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { pan, name } = req.body;
            if (!pan) throw new BadRequestError('PAN number is required');

            const result = await this.cashfreeService.verifyPAN(pan.toUpperCase(), name);

            if (result.success) {
                return res.json(successResponse(result, result.message));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: (result as any).error });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * POST /kyc/cashfree/aadhaar/generate-otp
     * Step 1 of Aadhaar OTP-based verification.
     */
    aadhaarGenerateOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { aadhaar_number } = req.body;
            if (!aadhaar_number) throw new BadRequestError('Aadhaar number is required');
            if (!/^\d{12}$/.test(aadhaar_number)) throw new BadRequestError('Aadhaar must be a 12-digit number');

            const result = await this.cashfreeService.aadhaarGenerateOTP(aadhaar_number);

            if (result.success) {
                return res.json(successResponse({ ref_id: result.ref_id }, result.message));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: (result as any).error });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * POST /kyc/cashfree/aadhaar/verify-otp
     * Step 2 of Aadhaar OTP-based verification.
     */
    aadhaarVerifyOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ref_id, otp } = req.body;
            if (!ref_id || !otp) throw new BadRequestError('ref_id and otp are required');

            const result = await this.cashfreeService.aadhaarVerifyOTP(ref_id, otp);

            if (result.success) {
                return res.json(successResponse(result, result.message));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: (result as any).error });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * POST /kyc/cashfree/verify-bank
     * Bank account verification (penny drop / comprehensive check).
     */
    verifyBankAccount = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { account_number, ifsc, name } = req.body;
            if (!account_number || !ifsc) throw new BadRequestError('account_number and ifsc are required');

            const result = await this.cashfreeService.verifyBankAccount(account_number, ifsc.toUpperCase(), name);

            if (result.success) {
                return res.json(successResponse(result, result.message));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: (result as any).error });
            }
        } catch (error) {
            return next(error);
        }
    };

    // ─────────────────────────────────────────────────────────
    // WEBHOOK (PUBLIC — Cashfree calls this)
    // ─────────────────────────────────────────────────────────

    /**
     * POST /kyc/cashfree/webhook
     * Cashfree posts KYC events here. No auth — protected by IP allowlist in production.
     * Automatically approves/rejects the partner's KYC based on Cashfree's decision.
     */
    handleWebhook = async (req: Request, res: Response, _next: NextFunction) => {
        try {
            logger.info('Cashfree KYC Webhook hit', req.body);

            const result = await this.cashfreeService.handleKYCWebhook(req.body);

            // Always return 200 to Cashfree so it doesn't retry
            return res.status(200).json({ received: true, ...result });
        } catch (error) {
            logger.error('Cashfree Webhook processing error:', error);
            // Still return 200 to prevent retries on internal errors
            return res.status(200).json({ received: true, error: 'internal_processing_error' });
        }
    };

    // ─────────────────────────────────────────────────────────
    // PAYMENT GATEWAY
    // ─────────────────────────────────────────────────────────

    createOrder = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { amount, customerPhone, customerName, customerEmail } = req.body;
            const customerId = req.user!.userId;
            const orderId = `CF_ORDER_${Date.now()}`;

            const result = await this.cashfreeService.createOrder(orderId, amount, customerId, customerPhone, customerName, customerEmail);

            if (result.success) {
                return res.json(successResponse(result.data, result.message));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: result.error });
            }
        } catch (error) {
            return next(error);
        }
    };

    getOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { orderId } = req.params;
            if (!orderId) throw new BadRequestError('Order ID is required');

            const result = await this.cashfreeService.getOrderStatus(orderId);

            if (result.success) {
                return res.json(successResponse(result.data, 'Order status retrieved'));
            } else {
                return res.status(400).json({ success: false, message: result.message, error: result.error });
            }
        } catch (error) {
            return next(error);
        }
    };
}
