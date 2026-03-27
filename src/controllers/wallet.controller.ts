import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/wallet.service';
import { successResponse } from '../utils/response';

export class WalletController {
    private walletService: WalletService;

    constructor() {
        this.walletService = new WalletService();
    }

    getBalance = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const balance = await this.walletService.getWalletBalance(req.user!.userId);
            res.json(successResponse(balance, 'Wallet balance retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    addMoney = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.walletService.addMoney(req.user!.userId, req.body);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    withdraw = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.walletService.withdraw(req.user!.userId, req.body);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    getTransactions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.walletService.getTransactions(
                req.user!.userId,
                req.query
            );
            res.json(
                successResponse(
                    result.transactions,
                    'Transactions retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.walletService.getWalletBalance(req.user!.userId);
            res.json(successResponse({
                total_earned: data.totalEarned,
                payouts: data.pendingPayout,
                balance: data.balance
            }, 'Wallet stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };
}
