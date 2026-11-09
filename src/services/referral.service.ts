import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { getIO } from '../socket/socket.server';

export class ReferralService {
    /**
     * Get or create referral info for a user (Customer or Partner)
     */
    async getUserReferralInfo(userId: string) {
        let user = await prisma.user.findUnique({
            where: { id: userId },
            include: { service_partner: true, wallet: true }
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Generate code if missing
        if (!user.referral_code) {
            const prefix = user.role === 'SERVICE_PARTNER' ? 'SN-TECH' : 'SNEARAL';
            const randomPart = Math.floor(1000 + Math.random() * 9000);
            const newCode = `${prefix}-${randomPart}`;

            user = await prisma.user.update({
                where: { id: userId },
                data: { referral_code: newCode },
                include: { service_partner: true, wallet: true }
            });

            // Also sync on service partner record if partner
            if (user.service_partner && !user.service_partner.referral_code) {
                await prisma.servicePartner.update({
                    where: { id: user.service_partner.id },
                    data: { referral_code: newCode }
                });
            }
        }

        const config = await this.getOrCreateConfig();

        // Get trackings
        const trackings = await prisma.referralTracking.findMany({
            where: { referrer_user_id: userId },
            include: {
                referee: { select: { full_name: true, phone_number: true, created_at: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        const totalReferred = trackings.length;
        const pendingCount = trackings.filter(t => t.status === 'PENDING').length;
        const rewardedTrackings = trackings.filter(t => t.status === 'REWARDED');
        const rewardedCount = rewardedTrackings.length;
        const totalBonusEarned = rewardedTrackings.reduce((sum, t) => sum + (t.referrer_reward || 200), 0);

        const isPartner = user.role === 'SERVICE_PARTNER';
        const rewardAmount = isPartner ? config.partner_referrer_reward : (config.customer_referrer_reward || 200);
        const qualificationTarget = isPartner ? (config.partner_qualifying_jobs || 5) : 5;
        const refereeReward = isPartner ? config.partner_referee_reward : config.customer_referee_reward;

        const shareUrl = isPartner 
            ? `https://snearal.com/partner/join?ref=${user.referral_code}`
            : `https://snearal.com/invite?code=${user.referral_code}`;

        const shareText = isPartner
            ? `Join Snearal as an On-Demand Service Partner! Use my code ${user.referral_code} to get verified and earn daily instant payouts: ${shareUrl}`
            : `Refer your neighbours and earn rewards! Invite neighbours to SNEARAL using code ${user.referral_code}. Earn ₹${rewardAmount} in your wallet when your neighbour completes 5 orders: ${shareUrl}`;

        return {
            referralCode: user.referral_code,
            shareUrl,
            shareText,
            rewardAmount,
            refereeReward,
            qualificationTarget,
            totalReferred,
            pendingCount,
            rewardedCount,
            totalBonusEarned,
            walletBalance: user.wallet?.balance || 0,
            referrals: trackings.map(t => {
                const target = t.qualification_target || 5;
                const completed = t.status === 'REWARDED' ? target : Math.min(t.qualifying_count, target);
                return {
                    id: t.id,
                    refereeName: t.referee.full_name || 'Customer',
                    refereePhone: t.referee.phone_number ? `${t.referee.phone_number.slice(0, 4)}****${t.referee.phone_number.slice(-2)}` : 'N/A',
                    status: t.status === 'REWARDED' ? 'Reward credited' : 'In progress',
                    rawStatus: t.status,
                    completedOrders: completed,
                    targetOrders: target,
                    progressText: `${completed}/${target}`,
                    rewardAmount: t.referrer_reward || 200,
                    date: t.created_at,
                    rewardedAt: t.rewarded_at,
                };
            })
        };
    }

    /**
     * Check and reward customer referral when referee completes 5 orders
     */
    async checkAndRewardCustomerBooking(customerId: string): Promise<boolean | null> {
        try {
            // Find pending customer referral
            const pendingTracking = await prisma.referralTracking.findFirst({
                where: {
                    referee_user_id: customerId,
                    status: 'PENDING',
                    referral_type: { in: ['CUSTOMER_TO_CUSTOMER', 'PARTNER_TO_CUSTOMER'] }
                }
            });

            if (!pendingTracking) return null;

            // Check how many orders the referee customer has completed
            // Only successfully completed orders count
            const completedCount = await prisma.booking.count({
                where: {
                    customer_id: customerId,
                    status: { in: ['COMPLETED', 'RATED'] }
                }
            });

            const target = pendingTracking.qualification_target || 5;

            if (completedCount >= target) {
                logger.info(`🎉 Customer ${customerId} reached ${completedCount}/${target} completed orders! Rewarding referral ${pendingTracking.id}`);

                // Idempotent state transition: update status only if currently PENDING
                const updateRes = await prisma.referralTracking.updateMany({
                    where: {
                        id: pendingTracking.id,
                        status: 'PENDING'
                    },
                    data: {
                        status: 'REWARDED',
                        rewarded_at: new Date(),
                        qualifying_count: completedCount
                    }
                });

                if (updateRes.count === 0) {
                    // Already processed concurrently
                    return false;
                }

                const rewardAmount = pendingTracking.referrer_reward || 200;

                // 1. Credit Referrer Wallet with ₹200
                await this.creditUserWallet(
                    pendingTracking.referrer_user_id,
                    rewardAmount,
                    `🎁 Referral Bonus: Referred customer completed ${target} orders!`
                );

                // 2. Send notification to Referrer
                try {
                    const { NotificationService } = await import('./notification.service');
                    const notifService = new NotificationService();
                    await notifService.createNotification(
                        pendingTracking.referrer_user_id,
                        'WALLET_CREDIT',
                        'Referral Reward Credited! 🎉',
                        `₹${rewardAmount} has been credited to your wallet because your referred neighbour completed ${target} orders!`,
                        { type: 'REFERRAL_REWARD', rewardAmount }
                    );
                } catch (notifErr) {
                    logger.warn('Failed sending referral notification:', notifErr);
                }

                logger.info(`✅ Referral ${pendingTracking.id} rewarded successfully with ₹${rewardAmount}`);
                return true;
            } else {
                // Update progress count
                await prisma.referralTracking.update({
                    where: { id: pendingTracking.id },
                    data: { qualifying_count: completedCount }
                });
                return false;
            }
        } catch (error) {
            logger.error('Error rewarding customer referral:', error);
            return false;
        }
    }

    /**
     * Apply a referral code to a customer account
     */
    async applyReferralCode(userId: string, referralCode: string) {
        const cleanCode = referralCode ? referralCode.trim() : '';
        if (!cleanCode) {
            throw new BadRequestError('Referral code is required');
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || user.is_deleted) {
            throw new NotFoundError('User not found');
        }

        if (user.referral_code === cleanCode) {
            throw new BadRequestError('You cannot use your own referral code.');
        }

        // Check if user is already attributed to any referrer
        const existingAttribution = await prisma.referralTracking.findFirst({
            where: { referee_user_id: userId }
        });

        if (existingAttribution) {
            throw new BadRequestError('You have already applied a referral code.');
        }

        // Find referrer by code
        const referrer = await prisma.user.findFirst({
            where: {
                referral_code: cleanCode,
                is_deleted: false,
            }
        });

        if (!referrer || referrer.id === userId) {
            throw new BadRequestError('Invalid or inactive referral code.');
        }

        const config = await this.getOrCreateConfig();
        const rewardAmount = config.customer_referrer_reward || 200;

        const tracking = await prisma.referralTracking.create({
            data: {
                referrer_user_id: referrer.id,
                referee_user_id: userId,
                referral_type: referrer.role === 'SERVICE_PARTNER' ? 'PARTNER_TO_CUSTOMER' : 'CUSTOMER_TO_CUSTOMER',
                referral_code: cleanCode,
                status: 'PENDING',
                referrer_reward: rewardAmount,
                referee_reward: config.customer_referee_reward || 100,
                qualification_target: 5,
                qualifying_count: 0
            }
        });

        return tracking;
    }

    /**
     * Check and reward partner referral when referee partner finishes 5 completed jobs
     */
    async checkAndRewardPartnerCompletion(partnerId: string): Promise<boolean | null> {
        try {
            const partner = await prisma.servicePartner.findUnique({
                where: { id: partnerId }
            });

            if (!partner) return null;

            const pendingTracking = await prisma.referralTracking.findFirst({
                where: {
                    referee_user_id: partner.user_id,
                    status: 'PENDING',
                    referral_type: 'PARTNER_TO_PARTNER'
                }
            });

            if (!pendingTracking) return null;

            const completedCount = await prisma.booking.count({
                where: {
                    partner_id: partnerId,
                    status: { in: ['COMPLETED', 'RATED'] }
                }
            });

            const target = pendingTracking.qualification_target || 5;

            if (completedCount >= target) {
                logger.info(`🎉 Partner ${partnerId} reached ${completedCount}/${target} completed jobs! Paying out partner referral bonus`);

                // Credit referrer partner wallet
                await this.creditUserWallet(
                    pendingTracking.referrer_user_id,
                    pendingTracking.referrer_reward,
                    `🎁 Partner Referral Bonus: Referred partner completed ${target} jobs!`
                );

                await prisma.referralTracking.update({
                    where: { id: pendingTracking.id },
                    data: {
                        status: 'REWARDED',
                        rewarded_at: new Date(),
                        qualifying_count: completedCount
                    }
                });
                return true;
            } else {
                await prisma.referralTracking.update({
                    where: { id: pendingTracking.id },
                    data: { qualifying_count: completedCount }
                });
                return false;
            }
        } catch (error) {
            logger.error('Error rewarding partner referral:', error);
            return false;
        }
    }

    private async creditUserWallet(userId: string, amount: number, description: string) {
        let user = await prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true }
        });

        if (!user) return;

        let wallet = user.wallet;
        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    user_id: userId,
                    type: user.role === 'SERVICE_PARTNER' ? 'PROVIDER' : 'CUSTOMER',
                    balance: 0
                }
            });
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + amount;

        await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: balanceAfter }
            }),
            prisma.transaction.create({
                data: {
                    user_id: userId,
                    type: 'REFERRAL_BONUS' as any,
                    category: 'CREDIT',
                    amount,
                    balance_before: balanceBefore,
                    balance_after: balanceAfter,
                    description
                }
            })
        ]);

        try {
            const io = getIO();
            const namespace = user.role === 'SERVICE_PARTNER' ? '/partner' : '/customer';
            io.of(namespace).to(userId).emit('wallet:credit', {
                amount,
                description,
                newBalance: balanceAfter
            });
        } catch (e) {
            // Non-blocking
        }
    }

    async getOrCreateConfig() {
        let config = await prisma.referralConfig.findFirst();
        if (!config) {
            config = await prisma.referralConfig.create({
                data: {
                    customer_referrer_reward: 200,
                    customer_referee_reward: 100,
                    partner_referrer_reward: 1000,
                    partner_qualifying_jobs: 5,
                    partner_referee_reward: 500,
                    is_active: true,
                }
            });
        }
        return config;
    }

    async updateConfig(data: any) {
        const config = await this.getOrCreateConfig();
        return await prisma.referralConfig.update({
            where: { id: config.id },
            data: {
                ...(data.customer_referrer_reward !== undefined && { customer_referrer_reward: parseFloat(data.customer_referrer_reward) }),
                ...(data.customer_referee_reward !== undefined && { customer_referee_reward: parseFloat(data.customer_referee_reward) }),
                ...(data.partner_referrer_reward !== undefined && { partner_referrer_reward: parseFloat(data.partner_referrer_reward) }),
                ...(data.partner_qualifying_jobs !== undefined && { partner_qualifying_jobs: parseInt(data.partner_qualifying_jobs) }),
                ...(data.is_active !== undefined && { is_active: Boolean(data.is_active) }),
            }
        });
    }

    async getAllTrackings(filters: { limit?: number; offset?: number; status?: string }) {
        const where: any = {};
        if (filters.status) where.status = filters.status;

        const [trackings, total] = await Promise.all([
            prisma.referralTracking.findMany({
                where,
                include: {
                    referrer: { select: { id: true, full_name: true, phone_number: true, role: true } },
                    referee: { select: { id: true, full_name: true, phone_number: true, role: true } },
                },
                orderBy: { created_at: 'desc' },
                take: filters.limit || 50,
                skip: filters.offset || 0,
            }),
            prisma.referralTracking.count({ where })
        ]);

        return { trackings, total };
    }
}

export const referralService = new ReferralService();
