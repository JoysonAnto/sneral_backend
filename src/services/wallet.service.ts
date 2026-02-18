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
                    on_hold_balance: 0,
                    pending_payout: 0,
                    type: 'CUSTOMER', // Default, will be updated based on role if needed
                } as any, // Using 'as any' temporarily until client is regenerated
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
            // @ts-ignore: Property 'on_hold_balance' does not exist on type 'Wallet'
            onHoldBalance: wallet.on_hold_balance || 0,
            // @ts-ignore: Property 'pending_payout' does not exist on type 'Wallet'
            pendingPayout: wallet.pending_payout || 0,
            availableBalance: wallet.balance - wallet.locked_balance - ((wallet as any).on_hold_balance || 0),
            transactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                // @ts-ignore: Property 'category' does not exist on type 'Transaction'
                category: t.category,
                // @ts-ignore: Property 'status' does not exist on type 'Transaction'
                status: t.status,
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
                    on_hold_balance: 0,
                    pending_payout: 0,
                } as any,
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
                    category: 'CREDIT',
                    status: 'COMPLETED',
                    amount: data.amount,
                    description: `Wallet top-up via ${data.method}`,
                    balance_before: wallet!.balance,
                    balance_after: updatedWallet.balance,
                } as any,
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

        // Calculate available balance (Total - Locked - OnHold)
        // @ts-ignore
        const availableBalance = wallet.balance - wallet.locked_balance - (wallet.on_hold_balance || 0);

        if (data.amount > availableBalance) {
            throw new BadRequestError(`Insufficient available balance. Available: ₹${availableBalance}`);
        }

        if (data.amount < 100) {
            throw new BadRequestError('Minimum withdrawal amount is ₹100');
        }

        // Create withdrawal request (in production, this would go through approval)
        const result = await prisma.$transaction(async (tx) => {
            const updatedWallet = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    // Start by locking the balance (moved to pending_payout implicitly via locked_balance logic or explicit field)
                    // We stick to locked_balance for legacy logic but also update pending_payout for tracking
                    locked_balance: { increment: data.amount },
                    pending_payout: { increment: data.amount }
                } as any,
            });

            const transaction = await tx.transaction.create({
                data: {
                    user_id: userId,
                    type: 'PAYOUT',
                    category: 'DEBIT', // It's a hold technically until processed, but we debited available balance
                    status: 'PENDING',
                    amount: data.amount, // Negative? No, amount is absolute
                    description: 'Withdrawal request initiated',
                    balance_before: wallet.balance,
                    balance_after: updatedWallet.balance, // Total balance unchanged yet, only locked/available changed
                } as any,
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
        const { page = 1, limit = 20, type, category, startDate, endDate } = filters;

        const skip = (page - 1) * limit;

        let where: any = { user_id: userId };

        if (type) where.type = type;
        if (category) where.category = category;

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
                category: (t as any).category,
                status: (t as any).status,
                amount: t.amount,
                description: t.description,
                balanceBefore: t.balance_before,
                balanceAfter: t.balance_after,
                createdAt: t.created_at,
                metadata: (t as any).metadata,
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
            },
        };
    }

    // New Method: Distribute Earnings
    async distributeEarnings(bookingId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: { include: { service: true } },
                partner: { include: { user: true, business_partner: true } },
                customer: true,
                business_partner: true, // Include top-level business partner relation if any
            }
        }) as any;

        if (!booking) throw new NotFoundError('Booking not found');
        if (booking.status !== 'COMPLETED') throw new BadRequestError('Booking not completed');

        // Check if already distributed
        const existingTx = await prisma.transaction.findFirst({
            where: { booking_id: bookingId, type: 'COMMISSION' }
        });
        if (existingTx) return; // Idempotency check

        // Calculate Splits
        const totalAmount = booking.total_amount;
        let commissionRate = 0.15; // Default 15% for independent partners
        let platformFee = 0;
        let partnerEarnings = 0;

        // Check if associated with Business Partner
        // The booking might have direct relation or via partner
        // Using the logic from legacy BookingService:
        const businessPartnerId = (booking as any).business_partner_id; // Explicit field on Booking

        if (businessPartnerId) {
            const bp = await prisma.businessPartner.findUnique({
                where: { id: businessPartnerId }
            });
            if (bp) {
                commissionRate = bp.commission_rate;
            }
        }

        // Calculate Platform Fee (Commission)
        platformFee = totalAmount * commissionRate;

        // Calculate optional Tax (GST) if applicable on the commission? 
        // Or is tax deducted from Provider Share?
        // For simplicity and matching implementation plan:
        // "Tax Wallet" gets a cut. Let's say 18% GST is applicable on the Service Fee (Platform Fee).
        // OR GST is applicable on the Total Booking Amount?
        // As per PRD: "Tax Wallet (GST/VAT)".
        // Let's assume Tax is 5% of Total Amount (Service Tax) deducted from Provider's share,
        // OR assumes price included tax.
        // Let's stick to the simpler model: Platform Fee is x%, remaining is Provider.
        // Tax is handled internally by Platform from its fee or deducted from Provider?
        // I will stick to: Total = PlatformFee + PartnerEarnings.

        partnerEarnings = totalAmount - platformFee;

        // Get Platform/Admin User (Super Admin)
        const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (!superAdmin) throw new Error('Super Admin not found for Platform Wallet');

        // Get Provider User
        const providerUserId = booking.partner?.user_id;
        if (!providerUserId) throw new Error('Provider not found for booking');

        await prisma.$transaction(async (tx) => {
            // 1. Credit Platform Commission
            await this.updateWallet(tx, superAdmin.id, platformFee, 'CREDIT', 'COMMISSION', bookingId, `Commission for booking #${booking.booking_number}`);

            // 2. Credit Partner (ON HOLD)
            // We implement this by adding to 'on_hold_balance' and 'balance', but blocking withdrawal
            const providerWallet = await this.getOrCreateWallet(tx, providerUserId);

            await tx.wallet.update({
                where: { user_id: providerUserId },
                data: {
                    balance: { increment: partnerEarnings },
                    on_hold_balance: { increment: partnerEarnings }
                } as any
            });

            await tx.transaction.create({
                data: {
                    user_id: providerUserId,
                    type: 'BOOKING_PAYMENT',
                    category: 'HOLD', // It is held initially
                    status: 'COMPLETED',
                    amount: partnerEarnings,
                    description: `Earnings from booking #${booking.booking_number} (On Hold)`,
                    booking_id: bookingId,
                    balance_before: providerWallet.balance,
                    balance_after: providerWallet.balance + partnerEarnings,
                    metadata: {
                        hold_release_date: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
                    }
                } as any
            });

            // 3. Update Booking with Fee Details
            await tx.booking.update({
                where: { id: bookingId },
                data: {
                    platform_fee: platformFee,
                    commission_amount: partnerEarnings
                } as any
            });
        });
    }

    // Helper to update wallet and create transaction
    private async updateWallet(tx: any, userId: string, amount: number, category: string, type: string, bookingId: string, description: string) {
        const wallet = await this.getOrCreateWallet(tx, userId);

        const updatedWallet = await tx.wallet.update({
            where: { user_id: userId },
            data: {
                balance: { increment: amount }
            }
        });

        await tx.transaction.create({
            data: {
                user_id: userId,
                type,
                category,
                status: 'COMPLETED',
                amount,
                description,
                booking_id: bookingId,
                balance_before: wallet.balance,
                balance_after: updatedWallet.balance
            } as any
        });

        return updatedWallet;
    }

    private async getOrCreateWallet(tx: any, userId: string) {
        let wallet = await tx.wallet.findUnique({ where: { user_id: userId } });
        if (!wallet) {
            wallet = await tx.wallet.create({
                data: {
                    user_id: userId,
                    balance: 0,
                    locked_balance: 0,
                    on_hold_balance: 0,
                    pending_payout: 0,
                    type: 'CUSTOMER' // Default
                } as any
            });
        }
        return wallet;
    }

    // Internal method to process booking payment (Customer pays)
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
                    category: 'DEBIT',
                    status: 'COMPLETED',
                    amount: amount,
                    description: `Payment for booking #${bookingId}`,
                    balance_before: wallet.balance,
                    balance_after: updatedWallet.balance,
                    booking_id: bookingId,
                } as any,
            });

            return { wallet: updatedWallet, transaction };
        });

        return result.transaction;
    }

    // Deprecated/Legacy method support if needed, or remove
    async creditPartnerEarnings(_userId: string, bookingId: string, _amount: number) {
        // Redirect to new logic or keep for backward compatibility? 
        // Better to use distributeEarnings but that requires full booking context.
        // For now, let's keep a basic version or throw error to force update.
        return this.distributeEarnings(bookingId);
    }

    // Cron job to release held funds
    /**
     * Release held funds that have passed their cooling period
     * This should be called by a Cron job (e.g., every hour)
     */
    async releaseHeldFunds() {
        const now = new Date();

        // Find all HOLD transactions where release date has passed
        // Note: Check performance on large datasets. Index on metadata might be needed or specific column.
        // Prisma doesn't support JSON filtering easily on all DBs, but PostgreSQL does.
        // Assuming release_date was stored in metadata.hold_release_date

        // Ideally we should have a `release_at` column in Transaction or separate `Holds` table.
        // For MVP with current schema, we iterate or use raw query.
        // Or we can query `Transaction` where `category` = 'HOLD' AND `status` = 'COMPLETED' (meaning successfully held)

        // Better approach for MVP: Fetch all 'HOLD', check date in code (if volume low) OR use raw query.
        // Let's use a raw query for efficiency if possible, or simple fetch for now.

        const heldTransactions = await prisma.transaction.findMany({
            where: {
                category: 'HOLD',
            },
            take: 100 // Process in batches
        });

        let releasedCount = 0;

        for (const tx of heldTransactions) {
            const metadata = tx.metadata as any;
            // Check if release date has passed (default 24h if not set, or checks metadata)
            // For MVP, if status is 'COMPLETED' and category is 'HOLD', and it's created > 24 hours ago
            // Or if metadata has hold_release_date

            let releaseDate = new Date(tx.created_at.getTime() + 24 * 60 * 60 * 1000); // Default 24h
            if (metadata && metadata.hold_release_date) {
                releaseDate = new Date(metadata.hold_release_date);
            }

            if (releaseDate <= now) {
                await this.processRelease(tx.id);
                releasedCount++;
            }
        }

        return releasedCount;
    }

    private async processRelease(originalTxId: string) {
        await prisma.$transaction(async (trx) => {
            const originalTx = await trx.transaction.findUnique({ where: { id: originalTxId } });
            if (!originalTx || (originalTx.metadata as any)?.released) return;

            // 1. Move funds from OnHold to Balance
            // Note: In our distributeEarnings, we did balance += earnings AND on_hold += earnings.
            // This means 'balance' includes 'on_hold'.
            // So to release, we only decrement on_hold_balance.
            const wallet = await trx.wallet.update({
                where: { user_id: originalTx.user_id },
                data: {
                    on_hold_balance: { decrement: originalTx.amount }
                } as any
            });

            // 2. Create Release Transaction
            await trx.transaction.create({
                data: {
                    user_id: originalTx.user_id,
                    type: 'BOOKING_PAYMENT',
                    category: 'RELEASE',
                    status: 'COMPLETED',
                    amount: originalTx.amount,
                    description: `Release of held funds from booking`,
                    booking_id: originalTx.booking_id,
                    balance_before: wallet.balance,
                    balance_after: wallet.balance, // Balance total doesn't change
                    metadata: { original_transaction_id: originalTxId }
                } as any
            });

            // 3. Update original transaction metadata to mark as released
            await trx.transaction.update({
                where: { id: originalTxId },
                data: {
                    metadata: {
                        ...(originalTx.metadata as object),
                        released: true,
                        released_at: new Date()
                    }
                }
            });
        });
    }
}
