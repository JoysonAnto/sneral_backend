import { Request, Response, NextFunction } from 'express';
import { PayoutService } from '../services/payout.service';
import { successResponse } from '../utils/response';

export class PayoutController {
    private payoutService: PayoutService;

    constructor() {
        this.payoutService = new PayoutService();
    }

    requestWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { amount } = req.body;
            const result = await this.payoutService.createWithdrawalRequest(req.user!.userId, amount);
            res.status(201).json(successResponse(result, 'Withdrawal request submitted successfully'));
        } catch (error) {
            next(error);
        }
    };

    getWithdrawalHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const history = await this.payoutService.getPartnerWithdrawals(req.user!.userId);
            res.json(successResponse(history, 'Withdrawal history retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Admin Methods
    getAllRequests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.payoutService.getAllWithdrawals(req.query);
            res.json(successResponse(result, 'All withdrawal requests retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    processWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;
            const result = await this.payoutService.processWithdrawal(id, req.user!.userId, status, notes);
            res.json(successResponse(result, `Withdrawal request ${status.toLowerCase()} successfully`));
        } catch (error) {
            next(error);
        }
    };
}
