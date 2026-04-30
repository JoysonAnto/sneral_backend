import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { validate } from '../middleware/validate.middleware';
import { submitReviewValidator, listReviewsValidator } from '../validators/review.validator';
import { param } from 'express-validator';

const router = Router();
const reviewController = new ReviewController();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /bookings/{id}/reviews:
 *   post:
 *     summary: Submit a review for a completed booking
 *     description: |
 *       Allows a CUSTOMER (type: CUSTOMER_TO_PARTNER) or SERVICE_PARTNER
 *       (type: PARTNER_TO_CUSTOMER) to submit one review per type per booking.
 *       Booking must be in COMPLETED status.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating, type]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [CUSTOMER_TO_PARTNER, PARTNER_TO_CUSTOMER]
 *     responses:
 *       201:
 *         description: Review submitted successfully
 *       400:
 *         description: Validation error or booking not completed
 *       403:
 *         description: Not a participant in this booking
 *       409:
 *         description: Review already submitted
 */
router.post(
    '/bookings/:id/reviews',
    authorize('CUSTOMER', 'SERVICE_PARTNER'),
    validate(submitReviewValidator),
    reviewController.submitReview
);

router.post(
    '/bookings/:id',
    authorize('CUSTOMER', 'SERVICE_PARTNER'),
    validate(submitReviewValidator),
    reviewController.submitReview
);

/**
 * @swagger
 * /bookings/{id}/reviews/status:
 *   get:
 *     summary: Get review submission status for a booking
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review status retrieved
 */
router.get(
    '/bookings/:id/reviews/status',
    validate([param('id').isUUID().withMessage('Invalid booking ID')]),
    reviewController.getReviewStatus
);

/**
 * @swagger
 * /partners/{partnerId}/reviews:
 *   get:
 *     summary: Get paginated reviews for a service partner
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Partner reviews with avg_rating and pagination
 */
router.get(
    '/partners/:partnerId/reviews',
    authorize(UserRole.SERVICE_PARTNER, UserRole.CUSTOMER, UserRole.BUSINESS_PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    validate(listReviewsValidator),
    reviewController.getPartnerReviews
);

router.get(
    '/partners/:partnerId',
    authorize(UserRole.SERVICE_PARTNER, UserRole.CUSTOMER, UserRole.BUSINESS_PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    validate(listReviewsValidator),
    reviewController.getPartnerReviews
);

/**
 * @swagger
 * /users/{userId}/reviews:
 *   get:
 *     summary: Get paginated reviews for a customer
 *     description: Allows partners to check a customer's reliability score before accepting a job.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Customer reviews with avg_rating and pagination
 */
router.get(
    '/users/:userId/reviews',
    authorize(UserRole.SERVICE_PARTNER, UserRole.CUSTOMER, UserRole.BUSINESS_PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    validate(listReviewsValidator),
    reviewController.getCustomerReviews
);

router.get(
    '/users/:userId',
    authorize(UserRole.SERVICE_PARTNER, UserRole.CUSTOMER, UserRole.BUSINESS_PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    validate(listReviewsValidator),
    reviewController.getCustomerReviews
);

/**
 * @swagger
 * /partners/{partnerId}/rating-summary:
 *   get:
 *     summary: Get star breakdown and average rating for a partner
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Partner rating summary retrieved
 */
router.get(
    '/partners/:partnerId/rating-summary',
    authorize(UserRole.CUSTOMER, UserRole.SERVICE_PARTNER, UserRole.BUSINESS_PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    reviewController.getPartnerRatingSummary
);

/**
 * @swagger
 * /users/{userId}/rating-summary:
 *   get:
 *     summary: Get star breakdown and average rating for a customer
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User rating summary retrieved
 */
router.get(
    '/users/:userId/rating-summary',
    authorize(UserRole.CUSTOMER, UserRole.SERVICE_PARTNER, UserRole.BUSINESS_PARTNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    reviewController.getUserRatingSummary
);

export default router;
