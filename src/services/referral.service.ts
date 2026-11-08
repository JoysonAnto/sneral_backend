import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
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
        const rewardedTrackings = trackings.filter(t => t.status === 'REWARDED');
        const rewardedCount = rewardedTrackings.length;
        const totalBonusEarned = rewardedTrackings.reduce((sum, t) => sum + t.referrer_reward, 0);

        const isPartner = user.role === 'SERVICE_PARTNER';
        const rewardAmount = isPartner ? config.partner_referrer_reward : config.customer_referrer_reward;
        const refereeReward = isPartner ? config.partner_referee_reward : config.customer_referee_reward;

        const shareUrl = isPartner 
            ? `https://snearal.com/partner/join?ref=${user.referral_code}`
            : `https://snearal.com/invite?code=${user.referral_code}`;

        const shareText = isPartner
            ? `Join Snearal as an On-Demand Service Partner! Use my code ${user.referral_code} to get verified and earn daily instant payouts: ${shareUrl}`
            : `Book trusted home services with Snearal! Use my invite code ${user.referral_code} to get ₹${refereeReward} OFF on your first booking: ${shareUrl}`;

        return {
            referralCode: user.referral_code,
            shareUrl,
            shareText,
            rewardAmount,
            refereeReward,
            totalReferred,
            rewardedCount,
            totalBonusEarned,
            walletBalance: user.wallet?.balance || 0,
            referrals: trackings.map(t => ({
                id: t.id,
                refereeName: t.referee.full_name,
                refereePhone: t.referee.phone_number ? `${t.referee.phone_number.slice(0, 4)}****${t.referee.phone_number.slice(-2)}` : 'N/A',
                status: t.status,
                rewardAmount: t.referrer_reward,
                date: t.created_at,
            }))
        };
    }

    /**
     * Check and reward customer referral when referee completes their first booking
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

            // Check if this is the customer's 1st completed booking
            const completedCount = await prisma.booking.count({
                where: {
                    customer_id: customerId,
                    status: { in: ['COMPLETED', 'RATED'] }
                }
            });

            if (completedCount >= 1) {
                logger.info(`🎉 Customer ${customerId} completed 1st booking! Qualifying referral ${pendingTracking.id}`);

                // 1. Credit Referrer Wallet
                await this.creditUserWallet(
                    pendingTracking.referrer_user_id,
                    pendingTracking.referrer_reward,
                    `🎁 Referral Bonus for referring new customer`
                );

                // 2. Credit Referee Customer Wallet
                await this.creditUserWallet(
                    customerId,
                    pendingTracking.referee_reward,
                    `🎁 Welcome Bonus: Referral discount for first booking`
                );

                // 3. Mark Rewarded
                await prisma.referralTracking.update({
                    where: { id: pendingTracking.id },
                    data: {
                        status: 'REWARDED',
                        rewarded_at: new Date(),
                        qualifying_count: 1
                    }
                });

                logger.info(`✅ Referral ${pendingTracking.id} rewarded successfully`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Error rewarding customer referral:', error);
            return false;
        }
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
                    customer_referrer_reward: 100,
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
