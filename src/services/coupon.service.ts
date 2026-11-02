import prisma from '../config/database';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { DiscountType } from '@prisma/client';

export interface CreateCouponInput {
    code: string;
    name: string;
    description?: string;
    discountType: 'FIXED' | 'PERCENTAGE';
    discountValue: number;
    maxDiscount?: number | null;
    minOrderAmount?: number;
    startDate: string | Date;
    expiryDate: string | Date;
    totalUsageLimit?: number | null;
    perUserUsageLimit?: number;
    newUserOnly?: boolean;
    applicableServices?: string[];
    termsConditions?: string;
    isActive?: boolean;
}

export interface UpdateCouponInput {
    name?: string;
    description?: string;
    discountType?: 'FIXED' | 'PERCENTAGE';
    discountValue?: number;
    maxDiscount?: number | null;
    minOrderAmount?: number;
    startDate?: string | Date;
    expiryDate?: string | Date;
    totalUsageLimit?: number | null;
    perUserUsageLimit?: number;
    newUserOnly?: boolean;
    applicableServices?: string[];
    termsConditions?: string;
    isActive?: boolean;
}

export interface ValidateCouponInput {
    code?: string;
    couponId?: string;
    amount: number;
    serviceId?: string;
    items?: { serviceId: string; quantity: number }[];
}

export class CouponService {
    /**
     * Normalizes coupon code to uppercase trimmed string
     */
    private normalizeCode(code: string): string {
        return code.trim().toUpperCase();
    }

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    /**
     * Create a new coupon
     */
    async createCoupon(data: CreateCouponInput) {
        const code = this.normalizeCode(data.code);

        const existing = await prisma.coupon.findUnique({
            where: { code },
        });

        if (existing) {
            throw new BadRequestError(`Coupon code "${code}" already exists`);
        }

        const startDate = new Date(data.startDate);
        const expiryDate = new Date(data.expiryDate);

        if (expiryDate <= startDate) {
            throw new BadRequestError('Expiry date must be after start date');
        }

        if (data.discountType === 'PERCENTAGE' && (data.discountValue <= 0 || data.discountValue > 100)) {
            throw new BadRequestError('Percentage discount must be between 1 and 100');
        }

        if (data.discountType === 'FIXED' && data.discountValue <= 0) {
            throw new BadRequestError('Fixed discount value must be greater than 0');
        }

        return prisma.coupon.create({
            data: {
                code,
                name: data.name.trim(),
                description: data.description?.trim() || null,
                discount_type: data.discountType as DiscountType,
                discount_value: Number(data.discountValue),
                max_discount: data.maxDiscount !== undefined && data.maxDiscount !== null ? Number(data.maxDiscount) : null,
                min_order_amount: data.minOrderAmount ? Number(data.minOrderAmount) : 0,
                start_date: startDate,
                expiry_date: expiryDate,
                total_usage_limit: data.totalUsageLimit !== undefined && data.totalUsageLimit !== null ? Number(data.totalUsageLimit) : null,
                per_user_usage_limit: data.perUserUsageLimit ? Math.max(1, Number(data.perUserUsageLimit)) : 1,
                new_user_only: Boolean(data.newUserOnly),
                applicable_services: Array.isArray(data.applicableServices) ? data.applicableServices : [],
                terms_conditions: data.termsConditions?.trim() || null,
                is_active: data.isActive !== undefined ? Boolean(data.isActive) : true,
            },
        });
    }

    /**
     * Get all coupons with filters for admin dashboard
     */
    async getAllCoupons(filters?: {
        status?: 'all' | 'active' | 'inactive' | 'expired' | 'upcoming';
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const page = Math.max(1, Number(filters?.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 20));
        const skip = (page - 1) * limit;

        const now = new Date();
        const where: any = {};

        if (filters?.search) {
            const search = filters.search.trim();
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (filters?.status && filters.status !== 'all') {
            if (filters.status === 'active') {
                where.is_active = true;
                where.start_date = { lte: now };
                where.expiry_date = { gte: now };
            } else if (filters.status === 'inactive') {
                where.is_active = false;
            } else if (filters.status === 'expired') {
                where.expiry_date = { lt: now };
            } else if (filters.status === 'upcoming') {
                where.start_date = { gt: now };
            }
        }

        const [coupons, total] = await Promise.all([
            prisma.coupon.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    _count: {
                        select: {
                            redemptions: {
                                where: { status: 'REDEEMED' },
                            },
                        },
                    },
                },
            }),
            prisma.coupon.count({ where }),
        ]);

        return {
            coupons: coupons.map(c => ({
                ...c,
                redeemedCount: c._count.redemptions,
                statusTag: !c.is_active
                    ? 'INACTIVE'
                    : c.expiry_date < now
                    ? 'EXPIRED'
                    : c.start_date > now
                    ? 'UPCOMING'
                    : 'ACTIVE',
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get single coupon by ID
     */
    async getCouponById(id: string) {
        const coupon = await prisma.coupon.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        redemptions: true,
                        bookings: true,
                    },
                },
            },
        });

        if (!coupon) {
            throw new NotFoundError('Coupon not found');
        }

        // Calculate total discount delivered
        const aggregated = await prisma.couponRedemption.aggregate({
            where: { coupon_id: id, status: 'REDEEMED' },
            _sum: { discount_amount: true },
        });

        return {
            ...coupon,
            totalDiscountGiven: aggregated._sum.discount_amount || 0,
        };
    }

    /**
     * Update coupon details
     */
    async updateCoupon(id: string, data: UpdateCouponInput) {
        const coupon = await prisma.coupon.findUnique({ where: { id } });
        if (!coupon) throw new NotFoundError('Coupon not found');

        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
        if (data.discountType !== undefined) updateData.discount_type = data.discountType as DiscountType;
        if (data.discountValue !== undefined) updateData.discount_value = Number(data.discountValue);
        if (data.maxDiscount !== undefined) updateData.max_discount = data.maxDiscount !== null ? Number(data.maxDiscount) : null;
        if (data.minOrderAmount !== undefined) updateData.min_order_amount = Number(data.minOrderAmount);
        if (data.startDate !== undefined) updateData.start_date = new Date(data.startDate);
        if (data.expiryDate !== undefined) updateData.expiry_date = new Date(data.expiryDate);
        if (data.totalUsageLimit !== undefined) updateData.total_usage_limit = data.totalUsageLimit !== null ? Number(data.totalUsageLimit) : null;
        if (data.perUserUsageLimit !== undefined) updateData.per_user_usage_limit = Math.max(1, Number(data.perUserUsageLimit));
        if (data.newUserOnly !== undefined) updateData.new_user_only = Boolean(data.newUserOnly);
        if (data.applicableServices !== undefined) updateData.applicable_services = data.applicableServices;
        if (data.termsConditions !== undefined) updateData.terms_conditions = data.termsConditions ? data.termsConditions.trim() : null;
        if (data.isActive !== undefined) updateData.is_active = Boolean(data.isActive);

        return prisma.coupon.update({
            where: { id },
            data: updateData,
        });
    }

    /**
     * Toggle coupon active / inactive status
     */
    async toggleCouponStatus(id: string, isActive?: boolean) {
        const coupon = await prisma.coupon.findUnique({ where: { id } });
        if (!coupon) throw new NotFoundError('Coupon not found');

        const newStatus = isActive !== undefined ? isActive : !coupon.is_active;

        return prisma.coupon.update({
            where: { id },
            data: { is_active: newStatus },
        });
    }

    /**
     * Delete coupon (only safe delete; retains redemption history)
     */
    async deleteCoupon(id: string) {
        const coupon = await prisma.coupon.findUnique({
            where: { id },
            include: { _count: { select: { redemptions: true } } },
        });

        if (!coupon) throw new NotFoundError('Coupon not found');

        // If coupon has been redeemed in the past, deactivate it instead of deleting to preserve financial audit trail
        if (coupon._count.redemptions > 0) {
            await prisma.coupon.update({
                where: { id },
                data: { is_active: false },
            });
            return {
                action: 'DEACTIVATED',
                message: 'Coupon has existing redemption history and was deactivated instead of deleted to preserve records.',
            };
        }

        await prisma.coupon.delete({ where: { id } });
        return {
            action: 'DELETED',
            message: 'Coupon deleted successfully.',
        };
    }

    /**
     * Get redemption history for a coupon
     */
    async getCouponRedemptions(couponId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [redemptions, total] = await Promise.all([
            prisma.couponRedemption.findMany({
                where: { coupon_id: couponId },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                    booking: {
                        select: {
                            id: true,
                            booking_number: true,
                            status: true,
                            payment_status: true,
                        },
                    },
                },
            }),
            prisma.couponRedemption.count({ where: { coupon_id: couponId } }),
        ]);

        return {
            redemptions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get overall coupon statistics for Admin Dashboard
     */
    async getCouponStats() {
        const now = new Date();

        const [total, active, expired, redemptionsAgg] = await Promise.all([
            prisma.coupon.count(),
            prisma.coupon.count({
                where: {
                    is_active: true,
                    start_date: { lte: now },
                    expiry_date: { gte: now },
                },
            }),
            prisma.coupon.count({
                where: { expiry_date: { lt: now } },
            }),
            prisma.couponRedemption.aggregate({
                where: { status: 'REDEEMED' },
                _count: { id: true },
                _sum: { discount_amount: true },
            }),
        ]);

        return {
            totalCoupons: total,
            activeCoupons: active,
            expiredCoupons: expired,
            inactiveCoupons: Math.max(0, total - active - expired),
            totalRedemptions: redemptionsAgg._count.id || 0,
            totalDiscountGiven: redemptionsAgg._sum.discount_amount || 0,
        };
    }

    // ==========================================
    // CUSTOMER / CHECKOUT FLOW
    // ==========================================

    /**
     * List all eligible coupons for a customer during checkout
     */
    async getAvailableCoupons(userId: string, serviceId?: string, orderAmount?: number) {
        const now = new Date();
        const amount = Number(orderAmount) || 0;

        // Fetch all active, currently valid coupons
        const activeCoupons = await prisma.coupon.findMany({
            where: {
                is_active: true,
                start_date: { lte: now },
                expiry_date: { gte: now },
            },
            orderBy: { created_at: 'desc' },
        });

        // Check if user has prior bookings (for new_user_only check)
        const priorBookingsCount = await prisma.booking.count({
            where: {
                customer_id: userId,
                status: { notIn: ['CANCELLED'] },
            },
        });
        const isNewUser = priorBookingsCount === 0;

        // Fetch user's completed redemptions
        const userRedemptions = await prisma.couponRedemption.groupBy({
            by: ['coupon_id'],
            where: {
                user_id: userId,
                status: 'REDEEMED',
            },
            _count: { id: true },
        });
        const userUsageMap = new Map(userRedemptions.map(r => [r.coupon_id, r._count.id]));

        // Filter and calculate potential discount
        const eligibleCoupons = [];

        for (const coupon of activeCoupons) {
            // 1. Check total usage limit
            if (coupon.total_usage_limit !== null && coupon.used_count >= coupon.total_usage_limit) {
                continue;
            }

            // 2. Check per user limit
            const userUsed = userUsageMap.get(coupon.id) || 0;
            if (userUsed >= coupon.per_user_usage_limit) {
                continue;
            }

            // 3. Check new user only condition
            if (coupon.new_user_only && !isNewUser) {
                continue;
            }

            // 4. Check applicable service
            if (coupon.applicable_services.length > 0 && serviceId) {
                if (!coupon.applicable_services.includes(serviceId)) {
                    continue;
                }
            }

            // Calculate potential discount if order amount is provided
            let estimatedDiscount = 0;
            let meetsMinOrder = true;

            if (amount > 0) {
                meetsMinOrder = amount >= coupon.min_order_amount;
                if (coupon.discount_type === 'FIXED') {
                    estimatedDiscount = Math.min(coupon.discount_value, amount);
                } else {
                    const rawDisc = (amount * coupon.discount_value) / 100;
                    estimatedDiscount = coupon.max_discount ? Math.min(rawDisc, coupon.max_discount) : rawDisc;
                    estimatedDiscount = Math.min(estimatedDiscount, amount);
                }
                estimatedDiscount = Math.round(estimatedDiscount * 100) / 100;
            }

            eligibleCoupons.push({
                id: coupon.id,
                code: coupon.code,
                name: coupon.name,
                description: coupon.description,
                discountType: coupon.discount_type,
                discountValue: coupon.discount_value,
                maxDiscount: coupon.max_discount,
                minOrderAmount: coupon.min_order_amount,
                expiryDate: coupon.expiry_date,
                termsConditions: coupon.terms_conditions,
                newUserOnly: coupon.new_user_only,
                estimatedDiscount,
                meetsMinOrder,
            });
        }

        return eligibleCoupons;
    }

    /**
     * Strict coupon validation against business rules
     */
    async validateCoupon(userId: string, input: ValidateCouponInput) {
        const code = input.code ? this.normalizeCode(input.code) : undefined;
        const couponId = input.couponId;
        const amount = Number(input.amount);

        if (!code && !couponId) {
            throw new BadRequestError('Coupon code or ID is required');
        }

        if (isNaN(amount) || amount <= 0) {
            throw new BadRequestError('Order amount must be greater than 0');
        }

        // 1. Check coupon exists
        const coupon = couponId
            ? await prisma.coupon.findUnique({ where: { id: couponId } })
            : await prisma.coupon.findUnique({ where: { code: code! } });

        if (!coupon) {
            throw new BadRequestError('Invalid coupon code.');
        }

        // 2. Check coupon is active
        if (!coupon.is_active) {
            throw new BadRequestError('Coupon is currently inactive.');
        }

        // 3. Check validity period
        const now = new Date();
        if (now < coupon.start_date) {
            throw new BadRequestError(`Coupon is not active yet. Valid from ${coupon.start_date.toLocaleDateString('en-IN')}.`);
        }
        if (now > coupon.expiry_date) {
            throw new BadRequestError('Coupon has expired.');
        }

        // 4. Check minimum order amount
        if (amount < coupon.min_order_amount) {
            throw new BadRequestError(`Minimum order amount of ₹${coupon.min_order_amount} required to use this coupon.`);
        }

        // 5. Check total usage limit
        if (coupon.total_usage_limit !== null && coupon.used_count >= coupon.total_usage_limit) {
            throw new BadRequestError('Coupon usage limit has been exceeded.');
        }

        // 6. Check per user usage limit
        const userRedemptionsCount = await prisma.couponRedemption.count({
            where: {
                coupon_id: coupon.id,
                user_id: userId,
                status: 'REDEEMED',
            },
        });

        if (userRedemptionsCount >= coupon.per_user_usage_limit) {
            throw new BadRequestError('You have already used this coupon.');
        }

        // 7. Check applicable services if specified
        if (coupon.applicable_services && coupon.applicable_services.length > 0) {
            const applicableSet = new Set(coupon.applicable_services);
            const targetServices: string[] = [];

            if (input.serviceId) targetServices.push(input.serviceId);
            if (input.items && Array.isArray(input.items)) {
                input.items.forEach(i => targetServices.push(i.serviceId));
            }

            if (targetServices.length > 0) {
                const isApplicable = targetServices.some(sId => applicableSet.has(sId));
                if (!isApplicable) {
                    throw new BadRequestError('Coupon is not applicable to the selected service(s).');
                }
            }
        }

        // 8. Check new-customer-only condition
        if (coupon.new_user_only) {
            const priorBookings = await prisma.booking.count({
                where: {
                    customer_id: userId,
                    status: { notIn: ['CANCELLED'] },
                },
            });

            if (priorBookings > 0) {
                throw new BadRequestError('This coupon is valid for new customers only.');
            }
        }

        // 9. Calculate discount
        let discountAmount = 0;
        if (coupon.discount_type === 'FIXED') {
            discountAmount = Math.min(coupon.discount_value, amount);
        } else {
            // Percentage discount
            const rawDiscount = (amount * coupon.discount_value) / 100;
            discountAmount = coupon.max_discount ? Math.min(rawDiscount, coupon.max_discount) : rawDiscount;
            discountAmount = Math.min(discountAmount, amount);
        }

        discountAmount = Math.round(discountAmount * 100) / 100;
        const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);

        return {
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                name: coupon.name,
                description: coupon.description,
                discountType: coupon.discount_type,
                discountValue: coupon.discount_value,
                maxDiscount: coupon.max_discount,
                minOrderAmount: coupon.min_order_amount,
            },
            discountAmount,
            finalAmount,
            originalAmount: amount,
            message: 'Coupon applied successfully!',
        };
    }

    /**
     * Reserve coupon redemption upon booking creation (Status: PENDING)
     */
    async reserveCouponRedemption(
        couponId: string,
        userId: string,
        bookingId: string,
        discountAmount: number,
        orderAmount: number
    ) {
        return prisma.couponRedemption.create({
            data: {
                coupon_id: couponId,
                user_id: userId,
                booking_id: bookingId,
                discount_amount: discountAmount,
                order_amount: orderAmount,
                status: 'PENDING',
            },
        });
    }

    /**
     * Confirm coupon redemption after verified successful payment
     */
    async confirmCouponRedemption(bookingId: string) {
        const redemption = await prisma.couponRedemption.findFirst({
            where: {
                booking_id: bookingId,
                status: 'PENDING',
            },
            include: { coupon: true },
        });

        if (!redemption) return null;

        // Atomically mark redeemed and increment coupon usage count
        return prisma.$transaction([
            prisma.couponRedemption.update({
                where: { id: redemption.id },
                data: {
                    status: 'REDEEMED',
                    redeemed_at: new Date(),
                },
            }),
            prisma.coupon.update({
                where: { id: redemption.coupon_id },
                data: {
                    used_count: { increment: 1 },
                },
            }),
        ]);
    }

    /**
     * Release pending coupon reservation on payment failure / booking cancellation
     */
    async releaseCouponRedemption(bookingId: string) {
        const redemption = await prisma.couponRedemption.findFirst({
            where: {
                booking_id: bookingId,
                status: 'PENDING',
            },
        });

        if (!redemption) return null;

        return prisma.couponRedemption.update({
            where: { id: redemption.id },
            data: {
                status: 'FAILED',
            },
        });
    }
}
