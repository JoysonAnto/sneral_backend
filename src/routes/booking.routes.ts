import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { authenticateToken, authorize, checkPermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
    createBookingValidator,
    updateBookingStatusValidator,
    assignPartnerValidator,
    cancelBookingValidator,
    rateBookingValidator,
    rejectBookingValidator,
} from '../validators/booking.validator';

const router = Router();
const bookingController = new BookingController();

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Lifecycle management for service orders
 */

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Retrieve all bookings for the authenticated user/partner
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookings retrieved
 */
router.get('/', (req: any, res, next) => {
    // Customers and Partners can see their own bookings. Admins/SuperAdmins are permitted by default.
    if (['CUSTOMER', 'SERVICE_PARTNER', 'BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN', 'SUPER-ADMIN'].includes(req.user?.role)) {
        return next();
    }
    return checkPermission('BOOKING_VIEW')(req, res, next);
}, bookingController.getAll);
/**
* @swagger
* /jobs:
 *   get:
 *     summary: Fetch job history and current tasks
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by job status
 *     responses:
 *       200:
 *         description: List of jobs
 */
router.get('/', bookingController.getAll);

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a new booking request
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - serviceAddress
 *               - serviceLatitude
 *               - serviceLongitude
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     serviceId: { type: string }
 *                     quantity: { type: number }
 *               scheduledDate: { type: string, format: date-time }
 *               serviceAddress: { type: string }
 *               serviceLatitude: { type: number }
 *               serviceLongitude: { type: number }
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post(
    '/',
    authorize('CUSTOMER'),
    validate(createBookingValidator),
    bookingController.create
);

/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     summary: Detailed view of a job
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking details retrieved
 */
router.get('/:id', (req: any, res, next) => {
    if (['CUSTOMER', 'SERVICE_PARTNER', 'BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
        return next();
    }
    return checkPermission('BOOKING_VIEW')(req, res, next);
}, bookingController.getById);

/**
 * @swagger
 * /bookings/{id}/status:
 *   patch:
 *     summary: Update the status of a booking manually
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch(
    '/:id/status',
    (req: any, res, next) => {
        if (req.user?.role === 'SERVICE_PARTNER') return next();
        return checkPermission('BOOKING_MANAGE')(req, res, next);
    },
    validate(updateBookingStatusValidator),
    bookingController.updateStatus
);

/**
 * @swagger
 * /bookings/{id}/assign:
 *   post:
 *     summary: Assign a specific partner to a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Partner assigned
 */
router.post(
    '/:id/assign',
    (req: any, res, next) => {
        if (req.user?.role === 'BUSINESS_PARTNER') return next();
        return checkPermission('BOOKING_MANAGE')(req, res, next);
    },
    validate(assignPartnerValidator),
    bookingController.assignPartner
);

/**
 * @swagger
 * /jobs/{id}/accept:
 *   post:
 *     summary: Accept a nearby job request
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job accepted
 */
router.post(
    '/:id/accept',
    authorize('SERVICE_PARTNER'),
    bookingController.acceptBooking
);

/**
 * @swagger
 * /jobs/{id}/start:
 *   post:
 *     summary: Move job to IN_PROGRESS (Requires Customer OTP)
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job started
 */
router.post(
    '/:id/reject',
    authorize('SERVICE_PARTNER'),
    validate(rejectBookingValidator),
    bookingController.rejectBooking
);

// Complete booking (service partner only)
router.post(
    '/:id/complete',
    authorize('SERVICE_PARTNER'),
    bookingController.completeBooking
);

// Cancel booking
router.post(
    '/:id/cancel',
    validate(cancelBookingValidator),
    bookingController.cancel
);

// Rate booking (customer only)
router.post(
    '/:id/rate',
    authorize('CUSTOMER'),
    validate(rateBookingValidator),
    bookingController.rate
);

// Service Progress & Completion Routes
import { beforeServicePhotos, afterServicePhotos } from '../middleware/upload.middleware';

/**
 * @swagger
 * /jobs/{id}/arrive:
 *   post:
 *     summary: Mark arrival at customer location (Check-in)
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Arrival recorded
 */
router.post(
    '/:id/arrive',
    authorize('SERVICE_PARTNER'),
    bookingController.arriveAtLocation
);

/**
 * @swagger
 * /bookings/{id}/start:
 *   post:
 *     summary: Initiate service work (starts timer)
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: Service started
 */
router.post(
    '/:id/start',
    authorize('SERVICE_PARTNER'),
    bookingController.startBooking
);

/**
 * @swagger
 * /bookings/{id}/complete:
 *   post:
 *     summary: Request service completion and payment release
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: Completion request sent
 */
router.post(
    '/:id/complete',
    authorize('SERVICE_PARTNER'),
    bookingController.completeBooking
);

/**
 * @swagger
 * /bookings/{id}/cancel:
 *   post:
 *     summary: Cancel a booking with reason
 *     tags: [Bookings]
 *   patch:
 *     summary: Cancel a booking with reason (supports both POST and PATCH)
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: Booking cancelled
 */
router.route('/:id/cancel')
    .post(
        authorize('CUSTOMER', 'SERVICE_PARTNER', 'BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
        validate(cancelBookingValidator),
        bookingController.cancel
    )
    .patch(
        authorize('CUSTOMER', 'SERVICE_PARTNER', 'BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
        validate(cancelBookingValidator),
        bookingController.cancel
    );


/**
 * @swagger
 * /bookings/{id}/rate:
 *   post:
 *     summary: "[Deprecated] Use POST /bookings/{id}/reviews instead"
 *     description: Legacy endpoint kept for backward compatibility. Prefer /reviews.
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: Rating recorded
 */
router.post(
    '/:id/rate',
    authorize('CUSTOMER', 'SERVICE_PARTNER'),
    validate(rateBookingValidator),
    bookingController.rate
);



/**
 * @swagger
 * /bookings/{id}/before-photos:
 *   post:
 *     summary: Upload evidence photos before starting work
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: Photos uploaded successfully
 * /jobs/{id}/before-photos:
 *   post:
 *     summary: Upload photos before starting work
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Photos uploaded
 */
router.post(
    '/:id/before-photos',
    authorize('SERVICE_PARTNER'),
    bookingController.uploadBeforePhotos
);

/**
 * @swagger
 * /jobs/{id}/after-photos:
 *   post:
 *     summary: Upload photos of completed work
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Photos uploaded
 */
router.post(
    '/:id/after-photos',
    authorize('SERVICE_PARTNER'),
    bookingController.uploadAfterPhotos
);

router.post(
    '/:id/voice-messages',
    bookingController.sendVoiceMessage
);

router.get(
    '/:id/voice-messages',
    bookingController.getVoiceMessages
);

/**
 * @swagger
 * /bookings/{id}/generate-start-otp:
 *   post:
 *     summary: Generate Start OTP for the partner
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: OTP generated
 */
router.post(
    '/:id/generate-start-otp',
    authorize('CUSTOMER', 'SERVICE_PARTNER'),
    bookingController.generateStartOTP
);

/**
 * @swagger
 * /bookings/{id}/generate-otp:
 *   post:
 *     summary: Generate Completion OTP for the partner
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: OTP generated
 */
router.post(
    '/:id/generate-otp',
    authorize('CUSTOMER', 'SERVICE_PARTNER'),
    bookingController.generateCompletionOTP
);

/**
 * @swagger
 * /jobs/{id}/verify-otp:
 *   post:
 *     summary: Finalize job and trigger payment release via Completion OTP
 *     tags: [Job (Booking) Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job completed
 */
router.post(
    '/:id/verify-otp',
    authorize('SERVICE_PARTNER'),
    bookingController.verifyCompletionOTP
);

/**
 * @swagger
 * /bookings/partner/update-location:
 *   post:
 *     summary: Update real-time GPS coordinates of the partner
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: Location updated
 */
router.post(
    '/partner/update-location',
    authorize('SERVICE_PARTNER'),
    bookingController.updatePartnerLocation
);

/**
 * @swagger
 * /bookings/{id}/add-materials:
 *   patch:
 *     summary: Add material cost with bill proof image URL (Partner Action)
 *     tags: [Bookings]
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
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Material cost to add (commission-free)
 *               billImageUrl:
 *                 type: string
 *                 description: Cloudinary URL of the uploaded bill photo
 *     responses:
 *       200:
 *         description: Material cost recorded. Commission is NOT applied on this amount.
 */
router.patch(
    '/:id/add-materials',
    authorize('SERVICE_PARTNER'),
    bookingController.addMaterialCost
);

// Move Controller import inside the file or use an existing one if available
import { ReviewController } from '../controllers/review.controller';
const reviewControllerInstance = new ReviewController();

/**
 * @swagger
 * /bookings/reviews/my-reviews:
 *   get:
 *     summary: Get reviews written about the authenticated user
 *     tags: [Bookings, Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reviews retrieved
 */
router.get(
    '/reviews/my-reviews',
    authorize('CUSTOMER', 'SERVICE_PARTNER'),
    reviewControllerInstance.getMyReviews
);

/**
 * @swagger
 * /bookings/{id}/reviews:
 *   post:
 *     summary: Submit a review for a booking
 *     tags: [Bookings, Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Review submitted
 */
router.post(
    '/:id/reviews',
    authorize('CUSTOMER', 'SERVICE_PARTNER'),
    reviewControllerInstance.submitReview
);

export default router;

