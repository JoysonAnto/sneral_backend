import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

interface AddMoneyData {
    amount: number;
    method: string;
}

interface WithdrawData {
    amount: number;
    bankAccountId?: string;
}

export class WalletService {
    async getWalletBalance(userId: string) {
        let wallet = await prisma.wallet.findUnique({
            where: { user_id: userId },
        });

        // Create wallet if doesn't exist
        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    user_id: userId,
                    balance: 0,
                    locked_balance: 0,
                },
            });
        }

        const transactions = await prisma.transaction.findMany({
            where: { user_id: userId },
            take: 10,
            orderBy: { created_at: 'desc' },
        });

        return {
            balance: wallet.balance,
            currency: 'INR',
            lockedBalance: wallet.locked_balance,
            availableBalance: wallet.balance - wallet.locked_balance,
            transactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount,
                description: t.description,
                createdAt: t.created_at,
            })),
        };
    }

    async addMoney(userId: string, data: AddMoneyData) {
        // In production, this would integrate with payment gateway
        // For now, we'll simulate the process

        let wallet = await prisma.wallet.findUnique({
            where: { user_id: userId },
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    user_id: userId,
                    balance: 0,
                    locked_balance: 0,
                },
            });
        }

        // Create transaction and update wallet
        const result = await prisma.$transaction(async (tx) => {
            const updatedWallet = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    balance: { increment: data.amount },
                },
            });

            const transaction = await tx.transaction.create({
                data: {
                    user_id: userId,
                    type: 'WALLET_TOPUP',
                    amount: data.amount,
                    description: `Wallet top-up via ${data.method}`,
                    balance_before: wallet!.balance,
                    balance_after: updatedWallet.balance,
                },
            });

            return { wallet: updatedWallet, transaction };
        });

        return {
            transactionId: result.transaction.id,
            amount: data.amount,
            newBalance: result.wallet.balance,
            method: data.method,
            status: 'COMPLETED',
            message: 'Money added to wallet successfully',
        };
    }

    async withdraw(userId: string, data: WithdrawData) {
        // Get user role to check if they're a partner
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user || !['SERVICE_PARTNER', 'BUSINESS_PARTNER'].includes(user.role)) {
            throw new BadRequestError('Only partners can withdraw funds');
        }

        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId },
        });

        if (!wallet) {
            throw new NotFoundError('Wallet not found');
        }

        const availableBalance = wallet.balance - wallet.locked_balance;

        if (data.amount > availableBalance) {
            throw new BadRequestError('Insufficient balance');
        }

        if (data.amount < 100) {
            throw new BadRequestError('Minimum withdrawal amount is ₹100');
        }

        // Create withdrawal request (in production, this would go through approval)
        const result = await prisma.$transaction(async (tx) => {
            const updatedWallet = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    balance: { decrement: data.amount },
                },
            });

            const transaction = await tx.transaction.create({
                data: {
                    user_id: userId,
                    type: 'PAYOUT',
                    amount: data.amount,
                    description: 'Withdrawal to bank account',
                    balance_before: wallet.balance,
                    balance_after: updatedWallet.balance,
                },
            });

            return { wallet: updatedWallet, transaction };
        });

        return {
            transactionId: result.transaction.id,
            amount: data.amount,
            newBalance: result.wallet.balance,
            status: 'PROCESSING',
            estimatedTime: '2-3 business days',
            message: 'Withdrawal request submitted successfully',
        };
    }

    async getTransactions(userId: string, filters: any) {
        const { page = 1, limit = 20, type, startDate, endDate } = filters;

        const skip = (page - 1) * limit;

        let where: any = { user_id: userId };

        if (type) {
            where.type = type;
        }

        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at.gte = new Date(startDate);
            if (endDate) where.created_at.lte = new Date(endDate);
        }

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { created_at: 'desc' },
            }),
            prisma.transaction.count({ where }),
        ]);

        return {
            transactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount,
                description: t.description,
                balanceBefore: t.balance_before,
                balanceAfter: t.balance_after,
                createdAt: t.created_at,
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
            },
        };
    }

    // Internal method to process booking payment
    async processBookingPayment(userId: string, bookingId: string, amount: number) {
        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId },
        });

        if (!wallet || wallet.balance < amount) {
            throw new BadRequestError('Insufficient wallet balance');
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedWallet = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    balance: { decrement: amount },
                },
            });

            const transaction = await tx.transaction.create({
                data: {
                    user_id: userId,
                    type: 'BOOKING_PAYMENT',
                    amount: amount,
                    description: `Payment for booking #${bookingId}`,
                    balance_before: wallet.balance,
                    balance_after: updatedWallet.balance,
                    booking_id: bookingId,
                },
            });

            return { wallet: updatedWallet, transaction };
        });

        return result.transaction;
    }

    // Internal method to add earnings to partner wallet
    async creditPartnerEarnings(userId: string, bookingId: string, amount: number) {
        let wallet = await prisma.wallet.findUnique({
            where: { user_id: userId },
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    user_id: userId,
                    balance: 0,
                    locked_balance: 0,
                },
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedWallet = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    balance: { increment: amount },
                },
            });

            const transaction = await tx.transaction.create({
                data: {
                    user_id: userId,
                    type: 'BOOKING_PAYMENT',
                    amount: amount,
                    description: `Earnings from booking #${bookingId}`,
                    balance_before: wallet!.balance,
                    balance_after: updatedWallet.balance,
                    booking_id: bookingId,
                },
            });

            return { wallet: updatedWallet, transaction };
        });

        return result.transaction;
    }

    async creditPlatformCommission(bookingId: string, amount: number) {
        // Find a super admin to credit platform commission
        const superAdmin = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' }
        });

        if (superAdmin) {
            return await this.creditPartnerEarnings(superAdmin.id, bookingId, amount);
        }
        return null;
    }
}
