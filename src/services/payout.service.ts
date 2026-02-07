import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { AuditLogService } from './auditLog.service';
import { NotificationService } from './notification.service';
import { getIO } from '../socket/socket.server';
import { AdminService } from './admin.service';

const broadcastStatsUpdate = async () => {
    try {
        const io = getIO();
        const adminService = new AdminService();
        const stats = await adminService.getDashboardStats();
        io.of('/admin').emit('dashboard:stats_update', stats);
    } catch (error) {
        // Socket not initialized or other error
    }
};

export class PayoutService {
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService();
    }

    async createWithdrawalRequest(userId: string, amount: number) {
        // 1. Get user and partner details (to get bank info)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                service_partner: true,
                business_partner: true,
                wallet: true,
            },
        });

        if (!user || (!user.service_partner && !user.business_partner)) {
            throw new BadRequestError('Only partners can request withdrawals');
        }

        const partner = user.service_partner || user.business_partner;
        const wallet = user.wallet;

        if (!wallet) {
            throw new NotFoundError('Wallet not found');
        }

        // 2. Validate amount and bank details
        if (amount < 500) {
            throw new BadRequestError('Minimum withdrawal amount is ₹500');
        }

        const availableBalance = wallet.balance - wallet.locked_balance;
        if (amount > availableBalance) {
            throw new BadRequestError('Insufficient available balance');
        }

        if (!partner?.bank_account_number || !partner?.bank_ifsc_code) {
            throw new BadRequestError('Please update your bank details before requesting a withdrawal');
        }

        // 3. Create request and lock funds
        const withdrawal = await prisma.$transaction(async (tx) => {
            // Lock the balance
            await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    locked_balance: { increment: amount },
                },
            });

            // Create the request
            return await tx.withdrawalRequest.create({
                data: {
                    user_id: userId,
                    amount,
                    bank_account: {
                        account_name: partner.bank_account_name,
                        account_number: partner.bank_account_number,
                        ifsc_code: partner.bank_ifsc_code,
                    },
                    status: 'PENDING',
                },
            });
        });

        // 4. Send notification
        try {
            await this.notificationService.createNotification(
                userId,
                'GENERAL',
                'Withdrawal Requested',
                `Your withdrawal request for ₹${amount} has been received and is being processed.`,
                { withdrawalId: withdrawal.id }
            );
        } catch (error) {
            console.error('Failed to send withdrawal notification:', error);
        }

        return withdrawal;
    }

    async processWithdrawal(withdrawalId: string, adminId: string, status: 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'FAILED', notes?: string) {
        const withdrawal = await prisma.withdrawalRequest.findUnique({
            where: { id: withdrawalId },
            include: { user: { include: { wallet: true } } },
        });

        if (!withdrawal) {
            throw new NotFoundError('Withdrawal request not found');
        }

        if (withdrawal.status === 'COMPLETED' || withdrawal.status === 'REJECTED') {
            throw new BadRequestError(`Cannot process a withdrawal that is already ${withdrawal.status.toLowerCase()}`);
        }

        const userId = withdrawal.user_id;

        const result = await prisma.$transaction(async (tx) => {
            const now = new Date();

            // If completed, deduct from balance and unlock
            if (status === 'COMPLETED') {
                // Deduct from total balance AND unlock
                await tx.wallet.update({
                    where: { user_id: userId },
                    data: {
                        balance: { decrement: withdrawal.amount },
                        locked_balance: { decrement: withdrawal.amount },
                    },
                });

                // Create transaction record
                await tx.transaction.create({
                    data: {
                        user_id: userId,
                        type: 'PAYOUT',
                        amount: withdrawal.amount,
                        description: `Payout processed for request #${withdrawal.id}`,
                        balance_before: withdrawal.user.wallet!.balance,
                        balance_after: withdrawal.user.wallet!.balance - withdrawal.amount,
                    },
                });
            }

            // If rejected, just unlock
            if (status === 'REJECTED' || status === 'FAILED') {
                await tx.wallet.update({
                    where: { user_id: userId },
                    data: {
                        locked_balance: { decrement: withdrawal.amount },
                    },
                });
            }

            // Update request status
            return await tx.withdrawalRequest.update({
                where: { id: withdrawalId },
                data: {
                    status,
                    admin_notes: notes,
                    processed_at: now,
                    processed_by: adminId,
                },
            });
        });

        // Send notification
        try {
            let message = '';
            if (status === 'COMPLETED') message = `Your withdrawal of ₹${withdrawal.amount} has been successfully processed.`;
            else if (status === 'REJECTED') message = `Your withdrawal of ₹${withdrawal.amount} was rejected. Reason: ${notes}`;
            else if (status === 'APPROVED') message = `Your withdrawal of ₹${withdrawal.amount} has been approved and is being transferred.`;

            await this.notificationService.createNotification(
                userId,
                'GENERAL',
                'Withdrawal Update',
                message,
                { withdrawalId, status }
            );
        } catch (error) {
            console.error('Failed to send payout notification:', error);
        }

        // Audit log
        await AuditLogService.logAdminAction(
            'PROCESS_PAYOUT',
            adminId,
            'WITHDRAWAL_REQUEST',
            withdrawalId,
            undefined,
            { status, notes }
        );

        // Broadcast stats update to admins
        broadcastStatsUpdate();

        return result;
    }

    async getPartnerWithdrawals(userId: string) {
        return await prisma.withdrawalRequest.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
        });
    }

    async getAllWithdrawals(filters: any) {
        const { status, userId, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (userId) where.user_id = userId;

        const [requests, total] = await Promise.all([
            prisma.withdrawalRequest.findMany({
                where,
                include: {
                    user: {
                        select: {
                            full_name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.withdrawalRequest.count({ where }),
        ]);

        return {
            requests,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit),
            },
        };
    }
}
