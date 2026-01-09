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

export default router;
