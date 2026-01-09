import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { successResponse } from '../utils/response';

export class PaymentController {
    private paymentService: PaymentService;

    constructor() {
        this.paymentService = new PaymentService();
    }

    createPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.paymentService.createPayment(req.user!.userId, req.body);
            res.status(201).json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { paymentId, orderId, signature } = req.body;
            const result = await this.paymentService.verifyPayment(
                paymentId,
                orderId,
                signature,
                req.user!.userId
            );
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    processRefund = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { bookingId, amount, reason } = req.body;
            const result = await this.paymentService.processRefund(
                bookingId,
                amount,
                reason,
                req.user!.userId
            );
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    getPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.paymentService.getPaymentHistory(
                req.user!.userId,
                req.query
            );
            res.json(
                successResponse(
                    result.payments,
                    'Payment history retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    handleRazorpayWebhook = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const signature = req.headers['x-razorpay-signature'] as string;
            const result = await this.paymentService.handleRazorpayWebhook(req.body, signature);
            res.json(result);
        } catch (error) {
            next(error);
        }
    };
}
