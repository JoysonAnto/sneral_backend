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

        // Sync referral code between user and service_partner
        if (!user.referral_code) {
            const existingCode = user.service_partner?.referral_code;
            const prefix = user.role === 'SERVICE_PARTNER' ? 'SN-TECH' : 'SNEARAL';
            const randomPart = Math.floor(1000 + Math.random() * 9000);
            const newCode = existingCode || `${prefix}-${randomPart}`;

            user = await prisma.user.update({
                where: { id: userId },
                data: { referral_code: newCode },
                include: { service_partner: true, wallet: true }
            });
        }

        if (user.service_partner && user.service_partner.referral_code !== user.referral_code) {
            await prisma.servicePartner.update({
                where: { id: user.service_partner.id },
                data: { referral_code: user.referral_code }
            });
        }

        const config = await this.getOrCreateConfig();

        // Get trackings
        const trackings = await prisma.referralTracking.findMany({
            where: { referrer_user_id: userId },
            include: {
                referee: {
                    select: {
                        id: true,
                        full_name: true,
                        phone_number: true,
                        role: true,
                        created_at: true,
                        service_partner: { select: { id: true, created_at: true } }
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const totalReferred = trackings.length;
        const pendingCount = trackings.filter(t => t.status === 'PENDING').length;
        const rewardedTrackings = trackings.filter(t => t.status === 'REWARDED');
        const rewardedCount = rewardedTrackings.length;
        const totalBonusEarned = rewardedTrackings.reduce((sum, t) => sum + (t.referrer_reward || (t.referral_type === 'PARTNER_TO_PARTNER' ? 1500 : 200)), 0);

        const isPartner = user.role === 'SERVICE_PARTNER';
        const partnerReward = config.partner_referrer_reward || 1500;
        const customerReward = config.customer_referrer_reward || 200;
        const rewardAmount = isPartner ? partnerReward : customerReward;
        const qualificationTarget = isPartner ? (config.partner_qualifying_jobs || 30) : 5;
        const refereeReward = isPartner ? config.partner_referee_reward : config.customer_referee_reward;

        const partnerShareUrl = `https://snearal.com/partner/join?ref=${user.referral_code}`;
        const customerShareUrl = `https://snearal.com/invite?code=${user.referral_code}`;

        const partnerShareText = `Join Snearal as an On-Demand Service Partner! Use my code ${user.referral_code} to get verified and earn daily instant payouts: ${partnerShareUrl}`;
        const customerShareText = `Refer your neighbours and earn rewards! Invite neighbours to SNEARAL using code ${user.referral_code}. Earn ₹${customerReward} in your wallet when your neighbour completes 5 orders: ${customerShareUrl}`;

        const shareUrl = isPartner ? partnerShareUrl : customerShareUrl;
        const shareText = isPartner ? partnerShareText : customerShareText;

        return {
            referralCode: user.referral_code,
            referral_code: user.referral_code,
            shareUrl,
            share_url: shareUrl,
            shareText,
            share_text: shareText,
            partnerShareUrl,
            partner_share_url: partnerShareUrl,
            customerShareUrl,
            customer_share_url: customerShareUrl,
            partnerShareText,
            partner_share_text: partnerShareText,
            customerShareText,
            customer_share_text: customerShareText,
            rewardAmount,
            reward_per_referral: isPartner ? 1500 : 200,
            referral_bonus_amount: isPartner ? 1500 : 200,
            customer_bonus_amount: 200,
            partner_bonus_amount: 1500,
            refereeReward,
            qualificationTarget,
            totalReferred,
            total_referred: totalReferred,
            total_referrals: totalReferred,
            pendingCount,
            pending_referrals: pendingCount,
            rewardedCount,
            completed_referrals: rewardedCount,
            completed_onboarding: rewardedCount,
            totalBonusEarned,
            total_earned: totalBonusEarned,
            walletBalance: user.wallet?.balance || 0,
            referrals: trackings.map(t => {
                const isPartnerReferee = t.referral_type === 'PARTNER_TO_PARTNER';
                const ordersTarget = isPartnerReferee ? (t.qualification_target || 30) : 5;
                const completedOrders = t.status === 'REWARDED' ? ordersTarget : Math.min(t.qualifying_count, ordersTarget);
                const startDate = t.referee.service_partner?.created_at || t.referee.created_at;
                const daysWorking = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
                const daysTarget = isPartnerReferee ? 30 : null;

                let progressText = `${completedOrders}/${ordersTarget} orders`;
                if (isPartnerReferee && t.status !== 'REWARDED') {
                    progressText = `${completedOrders}/${ordersTarget} orders or ${daysWorking}/30 days (${completedOrders}/10 jobs)`;
                }

                return {
                    id: t.id,
                    name: t.referee.full_name || (isPartnerReferee ? 'Technician' : 'Customer'),
                    refereeName: t.referee.full_name || (isPartnerReferee ? 'Technician' : 'Customer'),
                    refereePhone: t.referee.phone_number ? `${t.referee.phone_number.slice(0, 4)}****${t.referee.phone_number.slice(-2)}` : 'N/A',
                    phone: t.referee.phone_number,
                    type: isPartnerReferee ? 'Technician' : 'Customer',
                    referral_type: t.referral_type,
                    status: t.status === 'REWARDED' ? 'COMPLETED' : 'IN_PROGRESS',
                    statusText: t.status === 'REWARDED' ? (isPartnerReferee ? '₹1,500 Paid' : '₹200 Paid') : 'In progress',
                    rawStatus: t.status,
                    completedOrders,
                    completed_orders: completedOrders,
                    targetOrders: ordersTarget,
                    orders_target: ordersTarget,
                    daysWorking,
                    days_working: daysWorking,
                    daysTarget,
                    progressText,
                    rewardAmount: t.referrer_reward || (isPartnerReferee ? 1500 : 200),
                    reward_amount: t.referrer_reward || (isPartnerReferee ? 1500 : 200),
                    date: t.created_at,
                    joined_at: t.created_at,
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

        // Find referrer by code (check user table and service_partner table)
        let referrer = await prisma.user.findFirst({
            where: {
                referral_code: cleanCode,
                is_deleted: false,
            }
        });

        if (!referrer) {
            const sp = await prisma.servicePartner.findFirst({
                where: { referral_code: cleanCode },
                include: { user: true }
            });
            if (sp && sp.user && !sp.user.is_deleted) {
                referrer = sp.user;
            }
        }

        if (!referrer || referrer.id === userId) {
            throw new BadRequestError('Invalid or inactive referral code.');
        }

        const config = await this.getOrCreateConfig();

        const isRefereePartner = user.role === 'SERVICE_PARTNER';
        const isReferrerPartner = referrer.role === 'SERVICE_PARTNER';
        let refType = 'CUSTOMER_TO_CUSTOMER';
        let target = 5;
        let rewardAmount = config.customer_referrer_reward || 200;
        let refereeReward = config.customer_referee_reward || 100;

        if (isRefereePartner && isReferrerPartner) {
            refType = 'PARTNER_TO_PARTNER';
            target = config.partner_qualifying_jobs || 30;
            rewardAmount = config.partner_referrer_reward || 1500;
            refereeReward = config.partner_referee_reward || 500;
        } else if (!isRefereePartner && isReferrerPartner) {
            refType = 'PARTNER_TO_CUSTOMER';
            target = 5;
            rewardAmount = config.customer_referrer_reward || 200;
            refereeReward = config.customer_referee_reward || 100;
        }

        const tracking = await prisma.referralTracking.create({
            data: {
                referrer_user_id: referrer.id,
                referee_user_id: userId,
                referral_type: refType as any,
                referral_code: cleanCode,
                status: 'PENDING',
                referrer_reward: rewardAmount,
                referee_reward: refereeReward,
                qualification_target: target,
                qualifying_count: 0
            }
        });

        return tracking;
    }

    /**
     * Check and reward partner referral when referee partner meets qualification condition:
     * Condition: Completed >= 30 orders OR (Worked for >= 30 days AND completed >= 10 orders)
     */
    async checkAndRewardPartnerCompletion(partnerId: string): Promise<boolean | null> {
        try {
            const partner = await prisma.servicePartner.findUnique({
                where: { id: partnerId },
                include: { user: true }
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

            // 1. Count completed orders
            const completedCount = await prisma.booking.count({
                where: {
                    partner_id: partnerId,
                    status: { in: ['COMPLETED', 'RATED'] }
                }
            });

            // 2. Count days working
            const startDate = partner.created_at || partner.user?.created_at || new Date();
            const daysWorking = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));

            const targetOrders = pendingTracking.qualification_target || 30;

            // Condition: 30 completed orders OR (30 days working with at least 10 completed jobs)
            const qualifiesByOrders = completedCount >= targetOrders;
            const qualifiesByDaysAndJobs = daysWorking >= 30 && completedCount >= 10;

            if (qualifiesByOrders || qualifiesByDaysAndJobs) {
                logger.info(`🎉 Partner ${partnerId} qualified for referral bonus! (Orders: ${completedCount}/${targetOrders}, Days: ${daysWorking}/30). Rewarding tracking ${pendingTracking.id}`);

                // Idempotent state transition
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
                    return false;
                }

                const rewardAmount = pendingTracking.referrer_reward || 1500;

                // Credit referrer partner wallet
                await this.creditUserWallet(
                    pendingTracking.referrer_user_id,
                    rewardAmount,
                    `🎁 Partner Referral Bonus: Referred technician ${partner.user?.full_name || ''} qualified! (${completedCount} jobs completed, ${daysWorking} days active)`
                );

                // Send in-app notification to referrer
                try {
                    const { NotificationService } = await import('./notification.service');
                    const notifService = new NotificationService();
                    await notifService.createNotification(
                        pendingTracking.referrer_user_id,
                        'WALLET_CREDIT',
                        'Partner Referral Reward Credited! 🎉',
                        `₹${rewardAmount} has been credited to your wallet because your referred technician qualified (${completedCount} jobs, ${daysWorking} days active)!`,
                        { type: 'PARTNER_REFERRAL_REWARD', rewardAmount, partnerId }
                    );
                } catch (notifErr) {
                    logger.warn('Failed sending partner referral notification:', notifErr);
                }

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

    /**
     * Evaluates all pending partner referrals (e.g. daily cron job)
     * Checks if any referee partner has reached 30 days active + 10 jobs or 30 orders
     */
    async evaluateAllPendingPartnerReferrals(): Promise<{ evaluated: number; rewarded: number }> {
        try {
            const pendingReferrals = await prisma.referralTracking.findMany({
                where: {
                    status: 'PENDING',
                    referral_type: 'PARTNER_TO_PARTNER'
                },
                include: {
                    referee: {
                        include: {
                            service_partner: true
                        }
                    }
                }
            });

            let rewardedCount = 0;
            for (const ref of pendingReferrals) {
                const partnerId = ref.referee.service_partner?.id;
                if (partnerId) {
                    const rewarded = await this.checkAndRewardPartnerCompletion(partnerId);
                    if (rewarded) rewardedCount++;
                }
            }

            logger.info(`Evaluated ${pendingReferrals.length} pending partner referrals, ${rewardedCount} rewarded.`);
            return { evaluated: pendingReferrals.length, rewarded: rewardedCount };
        } catch (error) {
            logger.error('Error evaluating pending partner referrals:', error);
            return { evaluated: 0, rewarded: 0 };
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
                    partner_referrer_reward: 1500,
                    partner_qualifying_jobs: 30,
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
