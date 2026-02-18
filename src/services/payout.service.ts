import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

export class PayoutService {
    async createWithdrawalRequest(userId: string, amount: number) {
        if (amount < 500) {
            throw new BadRequestError('Minimum withdrawal amount is ₹500');
        }

        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId },
            include: { user: true }
        });

        if (!wallet) {
            throw new NotFoundError('Wallet not found');
        }

        // Calculate available balance (Total - Locked - OnHold)
        // @ts-ignore
        const availableBalance = wallet.balance - wallet.locked_balance - (wallet.on_hold_balance || 0);

        if (amount > availableBalance) {
            throw new BadRequestError(`Insufficient available balance. Available: ₹${availableBalance}`);
        }

        // Check for existing pending request
        const pendingRequest = await prisma.withdrawalRequest.findFirst({
            where: {
                user_id: userId,
                status: 'PENDING'
            }
        });

        if (pendingRequest) {
            throw new BadRequestError('You already have a pending withdrawal request');
        }

        // Get bank details
        let bankDetails = {};
        if (wallet.user.role === 'SERVICE_PARTNER') {
            const partner = await prisma.servicePartner.findUnique({ where: { user_id: userId } });
            if (partner && (partner as any).bank_account) {
                bankDetails = (partner as any).bank_account;
            }
        }

        // Ensure bank details exist (Simple check)
        if (Object.keys(bankDetails).length === 0) {
            // throw new BadRequestError('Bank details not found'); 
            // Allowing for now as per previous logic, admin can reject
        }

        const result = await prisma.$transaction(async (tx) => {
            // Lock funds
            const updatedWallet = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    locked_balance: { increment: amount },
                    pending_payout: { increment: amount }
                } as any
            });

            // Create Request
            const request = await tx.withdrawalRequest.create({
                data: {
                    user_id: userId,
                    amount,
                    bank_account: bankDetails,
                    status: 'PENDING'
                }
            });

            // Create Transaction Record
            await tx.transaction.create({
                data: {
                    user_id: userId,
                    type: 'PAYOUT',
                    category: 'DEBIT',
                    status: 'PENDING',
                    amount,
                    description: 'Withdrawal Request',
                    balance_before: wallet.balance,
                    balance_after: updatedWallet.balance,
                    metadata: { withdrawal_request_id: request.id }
                } as any
            });

            return request;
        });

        return result;
    }

    async getPartnerWithdrawals(userId: string) {
        return await prisma.withdrawalRequest.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });
    }

    // Admin: Get All Withdrawals
    async getAllWithdrawals(filters: any) {
        const { status, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;

        const [requests, total] = await Promise.all([
            prisma.withdrawalRequest.findMany({
                where,
                include: { user: { select: { full_name: true, email: true, phone_number: true } } },
                skip,
                take: Number(limit),
                orderBy: { created_at: 'desc' }
            }),
            prisma.withdrawalRequest.count({ where })
        ]);

        return {
            requests,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total
            }
        };
    }

    // Admin: Process Withdrawal
    async processWithdrawal(requestId: string, adminId: string, status: 'APPROVED' | 'REJECTED' | 'COMPLETED', notes?: string) {
        const request = await prisma.withdrawalRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        });

        if (!request) throw new NotFoundError('Withdrawal request not found');

        // Validation of status transitions
        if (request.status === 'REJECTED' || request.status === 'COMPLETED') {
            throw new BadRequestError('Withdrawal request has already been processed');
        }

        if (request.status === 'APPROVED' && status !== 'COMPLETED') {
            throw new BadRequestError('Approved requests can only be marked as COMPLETED');
        }

        if (request.status === 'PENDING' && status === 'COMPLETED') {
            throw new BadRequestError('Pending requests must be APPROVED before they can be COMPLETED');
        }

        return await prisma.$transaction(async (tx) => {
            // Update Request Status
            const updatedRequest = await tx.withdrawalRequest.update({
                where: { id: requestId },
                data: {
                    status: status as any,
                    admin_notes: notes,
                    processed_by: adminId,
                    processed_at: new Date()
                }
            });

            if (status === 'REJECTED') {
                // Refund / Unlock funds
                const wallet = await tx.wallet.findUnique({ where: { user_id: request.user_id } });
                await tx.wallet.update({
                    where: { user_id: request.user_id },
                    data: {
                        locked_balance: { decrement: request.amount },
                        pending_payout: { decrement: request.amount }
                    } as any
                });

                // Add Reversal Transaction
                await tx.transaction.create({
                    data: {
                        user_id: request.user_id,
                        type: 'PAYOUT',
                        category: 'REVERSAL',
                        status: 'CANCELLED',
                        amount: request.amount,
                        description: `Withdrawal Rejected: ${notes || 'No reason'}`,
                        balance_before: wallet!.balance,
                        balance_after: wallet!.balance,
                        metadata: { withdrawal_request_id: requestId }
                    } as any
                });

            } else if (status === 'COMPLETED') {
                // Deduct from wallet permanently
                const wallet = await tx.wallet.findUnique({ where: { user_id: request.user_id } });
                const updated = await tx.wallet.update({
                    where: { user_id: request.user_id },
                    data: {
                        balance: { decrement: request.amount },
                        locked_balance: { decrement: request.amount },
                        pending_payout: { decrement: request.amount }
                    } as any
                });

                // Completed Transaction
                await tx.transaction.create({
                    data: {
                        user_id: request.user_id,
                        type: 'PAYOUT',
                        category: 'DEBIT',
                        status: 'COMPLETED',
                        amount: request.amount,
                        description: `Withdrawal Completed`,
                        balance_before: wallet!.balance,
                        balance_after: updated.balance,
                        metadata: { withdrawal_request_id: requestId }
                    } as any
                });
            }

            return updatedRequest;
        });
    }
}
