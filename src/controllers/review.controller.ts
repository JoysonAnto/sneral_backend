import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../services/review.service';
import { successResponse } from '../utils/response';

export class ReviewController {
    private reviewService: ReviewService;

    constructor() {
        this.reviewService = new ReviewService();
    }

    /**
     * POST /bookings/:id/reviews
     * Auth: CUSTOMER (type: CUSTOMER_TO_PARTNER) | SERVICE_PARTNER (type: PARTNER_TO_CUSTOMER)
     */
    submitReview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const review = await this.reviewService.submitReview(
                req.params.id,
                req.user!.userId,
                req.user!.role,
                req.body
            );
            res.status(201).json(successResponse(review, 'Review submitted successfully'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /bookings/:id/reviews/status
     * Auth: any participant — lets the UI know if a review was already submitted.
     */
    getReviewStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const status = await this.reviewService.getBookingReviewStatus(
                req.params.id,
                req.user!.userId
            );
            res.json(successResponse(status, 'Review status retrieved'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /partners/:partnerId/reviews
     * Auth: any authenticated user
     */
    getPartnerReviews = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.reviewService.getPartnerReviews(
                req.params.partnerId,
                req.query as any
            );
            res.json(successResponse(result, 'Partner reviews retrieved'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /users/:userId/reviews
     * Auth: any authenticated user (typically service partner viewing customer score)
     */
    getCustomerReviews = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.reviewService.getCustomerReviews(
                req.params.userId,
                req.query as any
            );
            res.json(successResponse(result, 'Customer reviews retrieved'));
        } catch (error) {
            next(error);
        }
    };
    /**
     * GET /partners/:partnerId/rating-summary
     */
    getPartnerRatingSummary = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.reviewService.getPartnerRatingSummary(req.params.partnerId);
            res.json(successResponse(result, 'Partner rating summary retrieved'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /users/:userId/rating-summary
     */
    getUserRatingSummary = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.reviewService.getCustomerRatingSummary(req.params.userId);
            res.json(successResponse(result, 'User rating summary retrieved'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /my-reviews
     * Auth: CUSTOMER or SERVICE_PARTNER
     */
    getMyReviews = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const role = req.user!.role;
            const userId = req.user!.userId;

            if (role === 'SERVICE_PARTNER') {
                // For partners, we need their service partner profile ID
                const db = await import('../config/database');
                const partner = await db.default.servicePartner.findUnique({
                    where: { user_id: userId },
                    select: { id: true }
                });

                if (!partner) {
                    return res.status(404).json({ success: false, message: 'Partner profile not found' });
                }

                const result = await this.reviewService.getPartnerReviews(partner.id, req.query as any);
                res.json(successResponse(result, 'My reviews retrieved'));
            } else {
                // For customers, use their base user ID
                const result = await this.reviewService.getCustomerReviews(userId, req.query as any);
                res.json(successResponse(result, 'My reviews retrieved'));
            }
        } catch (error) {
            next(error);
        }
    };
}
