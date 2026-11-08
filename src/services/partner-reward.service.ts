import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { getIO } from '../socket/socket.server';

export class PartnerRewardService {
    /**
     * Evaluate milestone rewards upon job completion
     */
    async evaluateMilestones(partnerId: string) {
        try {
            const partner = await prisma.servicePartner.findUnique({
                where: { id: partnerId },
                include: { user: true }
            });

            if (!partner) return null;

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const todayStr = new Date().toISOString().slice(0, 10);

            // Fetch today's completed bookings
            const completedToday = await prisma.booking.findMany({
                where: {
                    partner_id: partnerId,
                    status: { in: ['COMPLETED', 'RATED'] },
                    completed_at: { gte: startOfDay }
                },
                include: { items: { include: { service: true } } }
            });

            const completedJobsCount = completedToday.length;
            const completedMinutes = completedToday.reduce((sum, b) => sum + (b.actual_duration || b.estimated_duration || 60), 0);
            const completedHours = Math.round((completedMinutes / 60) * 10) / 10;

            // Fetch active daily reward rules
            const activeRules = await prisma.partnerRewardRule.findMany({
                where: { is_active: true, cycle: 'DAILY' },
                orderBy: { reward_amount: 'asc' }
            });

            const newlyAwarded = [];

            for (const rule of activeRules) {
                // Check if already claimed today
                const existingClaim = await prisma.partnerRewardClaim.findUnique({
                    where: {
                        partner_id_rule_id_cycle_date: {
                            partner_id: partnerId,
                            rule_id: rule.id,
                            cycle_date: todayStr
                        }
                    }
                });

                if (existingClaim) continue;

                // Evaluate condition
                let isQualified = false;
                const jobsTargetMet = rule.target_jobs ? completedJobsCount >= rule.target_jobs : false;
                const hoursTargetMet = rule.target_hours ? completedHours >= rule.target_hours : false;

                if (rule.condition_type === 'AND') {
                    isQualified = jobsTargetMet && hoursTargetMet;
                } else {
                    isQualified = jobsTargetMet || hoursTargetMet;
                }

                if (isQualified) {
                    logger.info(`🎉 Partner ${partner.user.full_name} qualified for reward: ${rule.title} (₹${rule.reward_amount})`);

                    // Credit wallet
                    const partnerUser = await prisma.user.findUnique({
                        where: { id: partner.user_id },
                        include: { wallet: true }
                    });

                    let wallet = partnerUser?.wallet;
                    if (!wallet) {
                        wallet = await prisma.wallet.create({
                            data: {
                                user_id: partner.user_id,
                                type: 'PROVIDER',
                                balance: 0
                            }
                        });
                    }

                    const balanceBefore = wallet.balance;
                    const balanceAfter = balanceBefore + rule.reward_amount;

                    // Update wallet balance and log transaction atomically
                    const [updatedWallet] = await prisma.$transaction([
                        prisma.wallet.update({
                            where: { id: wallet.id },
                            data: { balance: balanceAfter }
                        }),
                        prisma.transaction.create({
                            data: {
                                user_id: partner.user_id,
                                type: 'REWARD_BONUS' as any,
                                category: 'CREDIT',
                                amount: rule.reward_amount,
                                balance_before: balanceBefore,
                                balance_after: balanceAfter,
                                description: `🎉 Daily Milestone Bonus: ${rule.title}`
                            }
                        }),
                        prisma.partnerRewardClaim.create({
                            data: {
                                partner_id: partnerId,
                                rule_id: rule.id,
                                cycle_date: todayStr,
                                reward_amount: rule.reward_amount,
                                completed_jobs_at_claim: completedJobsCount,
                                completed_hours_at_claim: completedHours,
                            }
                        })
                    ]);

                    newlyAwarded.push({
                        ruleTitle: rule.title,
                        rewardAmount: rule.reward_amount,
                        newBalance: updatedWallet.balance
                    });

                    // Broadcast real-time celebration to partner app
                    try {
                        const io = getIO();
                        io.of('/partner').to(partner.user_id).emit('partner:reward_unlocked', {
                            title: rule.title,
                            amount: rule.reward_amount,
                            completedJobs: completedJobsCount,
                            completedHours,
                            newWalletBalance: updatedWallet.balance,
                            message: `🎉 Milestone Achieved! ₹${rule.reward_amount} added to your wallet for completing ${rule.title}!`
                        });
                    } catch (e) {
                        logger.warn('Socket reward celebration failed:', e);
                    }
                }
            }

            return newlyAwarded;
        } catch (error) {
            logger.error('Error in evaluateMilestones:', error);
            return null;
        }
    }

    /**
     * Get partner daily rewards progress
     */
    async getPartnerDailyRewards(partnerUserId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: partnerUserId }
        });

        if (!partner) {
            throw new NotFoundError('Partner record not found');
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayStr = new Date().toISOString().slice(0, 10);

        const completedToday = await prisma.booking.findMany({
            where: {
                partner_id: partner.id,
                status: { in: ['COMPLETED', 'RATED'] },
                completed_at: { gte: startOfDay }
            }
        });

        const completedJobs = completedToday.length;
        const completedMinutes = completedToday.reduce((sum, b) => sum + (b.actual_duration || b.estimated_duration || 60), 0);
        const completedHours = Math.round((completedMinutes / 60) * 10) / 10;

        const rules = await prisma.partnerRewardRule.findMany({
            where: { is_active: true, cycle: 'DAILY' },
            orderBy: { reward_amount: 'asc' }
        });

        const claims = await prisma.partnerRewardClaim.findMany({
            where: { partner_id: partner.id, cycle_date: todayStr }
        });

        const claimedRuleIds = new Set(claims.map(c => c.rule_id));

        const milestones = rules.map(r => {
            const isClaimed = claimedRuleIds.has(r.id);
            const targetJobs = r.target_jobs || 4;
            const targetHours = r.target_hours || 4.0;
            const jobsProgressPct = Math.min(100, Math.round((completedJobs / targetJobs) * 100));
            const hoursProgressPct = Math.min(100, Math.round((completedHours / targetHours) * 100));
            const overallPct = Math.max(jobsProgressPct, hoursProgressPct);

            return {
                id: r.id,
                title: r.title,
                targetJobs,
                targetHours,
                rewardAmount: r.reward_amount,
                isClaimed,
                jobsProgress: `${completedJobs}/${targetJobs}`,
                hoursProgress: `${completedHours}/${targetHours} hrs`,
                progressPercentage: isClaimed ? 100 : overallPct,
            };
        });

        return {
            todayStats: {
                completedJobs,
                completedHours,
                date: todayStr,
            },
            milestones,
            totalBonusEarnedToday: claims.reduce((sum, c) => sum + c.reward_amount, 0),
        };
    }

    // ============================================
    // ADMIN REWARD RULES MANAGEMENT
    // ============================================
    async getAllRules() {
        return await prisma.partnerRewardRule.findMany({
            include: {
                _count: { select: { claims: true } }
            },
            orderBy: { created_at: 'asc' }
        });
    }

    async createRule(data: {
        title: string;
        target_jobs?: number;
        target_hours?: number;
        condition_type?: string;
        reward_type?: string;
        reward_amount: number;
        cycle?: string;
    }) {
        return await prisma.partnerRewardRule.create({
            data: {
                title: data.title,
                target_jobs: data.target_jobs ? parseInt(data.target_jobs.toString()) : null,
                target_hours: data.target_hours ? parseFloat(data.target_hours.toString()) : null,
                condition_type: data.condition_type || 'OR',
                reward_type: (data.reward_type as any) || 'WALLET_MONEY',
                reward_amount: parseFloat(data.reward_amount.toString()),
                cycle: (data.cycle as any) || 'DAILY',
                is_active: true,
            }
        });
    }

    async updateRule(id: string, data: any) {
        return await prisma.partnerRewardRule.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.target_jobs !== undefined && { target_jobs: data.target_jobs ? parseInt(data.target_jobs.toString()) : null }),
                ...(data.target_hours !== undefined && { target_hours: data.target_hours ? parseFloat(data.target_hours.toString()) : null }),
                ...(data.reward_amount !== undefined && { reward_amount: parseFloat(data.reward_amount.toString()) }),
                ...(data.is_active !== undefined && { is_active: Boolean(data.is_active) }),
            }
        });
    }

    async deleteRule(id: string) {
        return await prisma.partnerRewardRule.delete({
            where: { id }
        });
    }

    async getRewardClaims(filters: { limit?: number; offset?: number; partnerId?: string }) {
        const where: any = {};
        if (filters.partnerId) where.partner_id = filters.partnerId;

        const [claims, total] = await Promise.all([
            prisma.partnerRewardClaim.findMany({
                where,
                include: {
                    partner: { include: { user: { select: { full_name: true, phone_number: true } } } },
                    rule: true,
                },
                orderBy: { created_at: 'desc' },
                take: filters.limit || 50,
                skip: filters.offset || 0,
            }),
            prisma.partnerRewardClaim.count({ where })
        ]);

        return { claims, total };
    }
}

export const partnerRewardService = new PartnerRewardService();
