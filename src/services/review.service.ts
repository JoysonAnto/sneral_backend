import prisma from '../config/database';
import sanitizeHtml from 'sanitize-html';
import { AppError } from '../utils/errors';

export class ReviewService {
    /**
     * Submit a review for a completed booking.
     * Validates: COMPLETED status, participant check, duplicate prevention, rating range.
     */
    async submitReview(
        bookingId: string,
        reviewerId: string,
        reviewerRole: string,
        data: { rating: number; comment?: string; type: 'CUSTOMER_TO_PARTNER' | 'PARTNER_TO_CUSTOMER' }
    ) {
        // 1. Fetch booking with participants
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                customer: { select: { id: true } },
                partner: { select: { user_id: true, id: true } },
            },
        });

        if (!booking) throw new AppError('Booking not found', 404);
        if (booking.status !== 'COMPLETED') {
            throw new AppError('Reviews can only be submitted for completed bookings', 400);
        }

        // 2. Validate rating range
        if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
            throw new AppError('Rating must be an integer between 1 and 5', 400);
        }

        // 3. Role / type consistency
        if (data.type === 'CUSTOMER_TO_PARTNER' && reviewerRole !== 'CUSTOMER') {
            throw new AppError('Only customers can submit CUSTOMER_TO_PARTNER reviews', 403);
        }
        if (data.type === 'PARTNER_TO_CUSTOMER' && reviewerRole !== 'SERVICE_PARTNER') {
            throw new AppError('Only service partners can submit PARTNER_TO_CUSTOMER reviews', 403);
        }

        // 4. Participant check
        const customerId = booking.customer.id;
        const partnerUserId = booking.partner?.user_id;

        if (data.type === 'CUSTOMER_TO_PARTNER') {
            if (reviewerId !== customerId) {
                throw new AppError('You are not the customer for this booking', 403);
            }
            if (!partnerUserId) {
                throw new AppError('No partner assigned to this booking', 400);
            }
        } else {
            if (reviewerId !== partnerUserId) {
                throw new AppError('You are not the assigned partner for this booking', 403);
            }
        }

        // 5. Determine reviewee
        const revieweeId =
            data.type === 'CUSTOMER_TO_PARTNER' ? partnerUserId! : customerId;

        // 6. Duplicate check (@@unique [booking_id, type])
        const existing = await prisma.review.findUnique({
            where: {
                booking_id_type: { booking_id: bookingId, type: data.type },
            },
        });
        if (existing) {
            throw new AppError('You have already submitted this review', 409);
        }

        // 7. Sanitize comment
        const sanitized = data.comment
            ? sanitizeHtml(data.comment.trim(), { allowedTags: [], allowedAttributes: {} })
            : undefined;

        // 8. Create review + recalculate avg within a transaction
        const review = await prisma.$transaction(async (tx) => {
            const created = await tx.review.create({
                data: {
                    booking_id: bookingId,
                    reviewer_id: reviewerId,
                    reviewee_id: revieweeId,
                    rating: data.rating,
                    comment: sanitized,
                    type: data.type,
                },
            });

            // Recalculate avg and total for the reviewee (User model)
            const agg = await tx.review.aggregate({
                where: { reviewee_id: revieweeId },
                _avg: { rating: true },
                _count: { rating: true },
            });

            await tx.user.update({
                where: { id: revieweeId },
                data: {
                    avg_rating: agg._avg.rating ?? 0,
                    total_reviews: agg._count.rating,
                },
            });

            // If reviewing a partner, also update ServicePartner's avg_rating / total_ratings
            if (data.type === 'CUSTOMER_TO_PARTNER' && booking.partner) {
                const partnerAgg = await tx.review.aggregate({
                    where: {
                        reviewee_id: revieweeId,
                        type: 'CUSTOMER_TO_PARTNER',
                    },
                    _avg: { rating: true },
                    _count: { rating: true },
                });

                await tx.servicePartner.update({
                    where: { id: booking.partner.id },
                    data: {
                        avg_rating: partnerAgg._avg.rating ?? 0,
                        total_ratings: partnerAgg._count.rating,
                    },
                });
            }

            return created;
        });

        return review;
    }

    /**
     * Get paginated reviews for a service partner.
     * Used by: customer app, public partner profile.
     */
    async getPartnerReviews(
        partnerId: string,
        query: { page?: string; limit?: string }
    ) {
        // partnerId here is the ServicePartner.id (profile id)
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
            select: { user_id: true, avg_rating: true, total_ratings: true },
        });

        if (!partner) throw new AppError('Partner not found', 404);

        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '10', 10)));
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: {
                    reviewee_id: partner.user_id,
                    type: 'CUSTOMER_TO_PARTNER',
                },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    created_at: true,
                    reviewer: {
                        select: { full_name: true, profile: { select: { avatar_url: true } } },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.review.count({
                where: { reviewee_id: partner.user_id, type: 'CUSTOMER_TO_PARTNER' },
            }),
        ]);

        return {
            avg_rating: partner.avg_rating,
            total_ratings: partner.total_ratings,
            reviews: reviews.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                customerName: r.reviewer.full_name,
                customerAvatar: r.reviewer.profile?.avatar_url ?? null,
                createdAt: r.created_at,
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get paginated reviews for a customer (so partners can see their reliability).
     * Used by: partner app — job detail screen.
     */
    async getCustomerReviews(
        userId: string,
        query: { page?: string; limit?: string }
    ) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, avg_rating: true, total_reviews: true, role: true },
        });

        if (!user) throw new AppError('User not found', 404);

        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '10', 10)));
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: {
                    reviewee_id: userId,
                    type: 'PARTNER_TO_CUSTOMER',
                },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    created_at: true,
                    reviewer: { select: { full_name: true } },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.review.count({
                where: { reviewee_id: userId, type: 'PARTNER_TO_CUSTOMER' },
            }),
        ]);

        return {
            avg_rating: user.avg_rating,
            total_reviews: user.total_reviews,
            reviews: reviews.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                partnerName: r.reviewer.full_name,
                createdAt: r.created_at,
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a single booking's review status (so the UI knows if review was already submitted).
     */
    async getBookingReviewStatus(bookingId: string, userId: string) {
        const reviews = await prisma.review.findMany({
            where: { booking_id: bookingId },
            select: { type: true, reviewer_id: true, rating: true },
        });

        return {
            customerReview: reviews.find((r) => r.type === 'CUSTOMER_TO_PARTNER') ?? null,
            partnerReview: reviews.find((r) => r.type === 'PARTNER_TO_CUSTOMER') ?? null,
            hasReviewed: reviews.some((r) => r.reviewer_id === userId),
        };
    }

    /**
     * Get a high-level rating summary including star breakdown.
     */
    async getPartnerRatingSummary(partnerId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
            select: { user_id: true, avg_rating: true, total_ratings: true },
        });

        if (!partner) throw new AppError('Partner not found', 404);

        // Get star breakdown via groupBy
        const breakdown = await prisma.review.groupBy({
            by: ['rating'],
            where: {
                reviewee_id: partner.user_id,
                type: 'CUSTOMER_TO_PARTNER',
            },
            _count: { rating: true },
        });

        // Initialize counts for all stars 1-5
        const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        breakdown.forEach((b) => {
            starCounts[b.rating] = b._count.rating;
        });

        return {
            avg_rating: partner.avg_rating,
            total_ratings: partner.total_ratings,
            star_breakdown: starCounts,
        };
    }

    async getCustomerRatingSummary(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { avg_rating: true, total_reviews: true },
        });

        if (!user) throw new AppError('User not found', 404);

        const breakdown = await prisma.review.groupBy({
            by: ['rating'],
            where: {
                reviewee_id: userId,
                type: 'PARTNER_TO_CUSTOMER',
            },
            _count: { rating: true },
        });

        const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        breakdown.forEach((b) => {
            starCounts[b.rating] = b._count.rating;
        });

        return {
            avg_rating: user.avg_rating,
            total_reviews: user.total_reviews,
            star_breakdown: starCounts,
        };
    }
}
