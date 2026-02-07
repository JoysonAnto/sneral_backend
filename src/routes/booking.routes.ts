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

// Get all bookings (with filtering)
router.get('/', bookingController.getAll);

// Create booking (customers only)
router.post(
    '/',
    authorize('CUSTOMER'),
    validate(createBookingValidator),
    bookingController.create
);

// Get booking by ID
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

// Accept booking (service partner only)
router.post(
    '/:id/accept',
    authorize('SERVICE_PARTNER'),
    bookingController.acceptBooking
);

// Start booking (service partner only)
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

// Mark arrival at service location (service partner only)
router.post(
    '/:id/arrive',
    authorize('SERVICE_PARTNER'),
    bookingController.arriveAtLocation
);

// Upload before-service photos (service partner only)
router.post(
    '/:id/before-photos',
    authorize('SERVICE_PARTNER'),
    beforeServicePhotos,
    bookingController.uploadBeforePhotos
);

// Upload after-service photos (service partner only)
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

// Verify OTP and complete service (service partner only)
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
