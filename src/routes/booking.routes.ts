import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
    createBookingValidator,
    updateBookingStatusValidator,
    assignPartnerValidator,
    cancelBookingValidator,
    rateBookingValidator,
} from '../validators/booking.validator';

const router = Router();
const bookingController = new BookingController();

// All routes require authentication
router.use(authenticateToken);

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

// Create booking (customers only)
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
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details
 */
router.get('/:id', bookingController.getById);

// Update booking status
router.patch(
    '/:id/status',
    authorize('ADMIN', 'SUPER_ADMIN', 'SERVICE_PARTNER'),
    validate(updateBookingStatusValidator),
    bookingController.updateStatus
);

// Assign partner to booking (admin/business partner only)
router.post(
    '/:id/assign',
    authorize('ADMIN', 'SUPER_ADMIN', 'BUSINESS_PARTNER'),
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
    '/:id/start',
    authorize('SERVICE_PARTNER'),
    bookingController.startBooking
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
    beforeServicePhotos,
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
    afterServicePhotos,
    bookingController.uploadAfterPhotos
);

// Generate start OTP (customer only)
router.post(
    '/:id/generate-start-otp',
    authorize('CUSTOMER'),
    bookingController.generateStartOTP
);

// Generate completion OTP (customer only)
router.post(
    '/:id/generate-otp',
    authorize('CUSTOMER'),
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

// Update partner location (service partner only)
router.post(
    '/partner/update-location',
    authorize('SERVICE_PARTNER'),
    bookingController.updatePartnerLocation
);

export default router;
