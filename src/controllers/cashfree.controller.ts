import { Request, Response, NextFunction } from 'express';
import { CashfreeService } from '../services/cashfree.service';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../utils/errors';

export class CashfreeController {
    private cashfreeService: CashfreeService;

    constructor() {
        this.cashfreeService = new CashfreeService();
    }

    /**
     * Generate a KYC Link for the mobile app
     */
    generateKYCLink = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { partnerId, phone, name, email } = req.body;

            if (!phone) {
                throw new BadRequestError('Phone number is required');
            }

            // Create a unique verification ID
            const verificationId = `snearal_${partnerId || 'anon'}_${Date.now()}`;

            const result = await this.cashfreeService.generateKYCLink(verificationId, phone, name, email);

            if (result.success) {
                return res.json(successResponse({
                    ...result.data,
                    verification_id: verificationId
                }, result.message));
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message,
                    error: result.error
                });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * Check status of a KYC link
     */
    getKYCStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { verificationId } = req.params;

            if (!verificationId) {
                throw new BadRequestError('Verification ID is required');
            }

            const result = await this.cashfreeService.getKYCStatus(verificationId);

            if (result.success) {
                return res.json(successResponse(result.data, result.message));
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message,
                    error: result.error
                });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * Create a payment order for the mobile app
     */
    createOrder = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { amount, customerPhone, customerName, customerEmail } = req.body;
            const customerId = req.user!.userId;
            const orderId = `CF_ORDER_${Date.now()}`;

            const result = await this.cashfreeService.createOrder(
                orderId,
                amount,
                customerId,
                customerPhone,
                customerName,
                customerEmail
            );

            if (result.success) {
                return res.json(successResponse(result.data, result.message));
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message,
                    error: result.error
                });
            }
        } catch (error) {
            return next(error);
        }
    };

    /**
     * Get status of a payment order
     */
    getOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                throw new BadRequestError('Order ID is required');
            }

            const result = await this.cashfreeService.getOrderStatus(orderId);

            if (result.success) {
                return res.json(successResponse(result.data, result.message));
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.message,
                    error: result.error
                });
            }
        } catch (error) {
            return next(error);
        }
    };
}
