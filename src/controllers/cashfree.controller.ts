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
}
