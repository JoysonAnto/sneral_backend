import { Router } from 'express';
import { LocationTrackingController } from '../controllers/location-tracking.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const locationController = new LocationTrackingController();

// All routes require authentication
router.use(authenticateToken);

// ================
// PARTNER ROUTES
// ================

// Update current location (called periodically when online)
router.post(
    '/partner/location',
    authorize('SERVICE_PARTNER'),
    locationController.updateLocation
);

// Get own location history
router.get(
    '/partner/location/history',
    authorize('SERVICE_PARTNER'),
    locationController.getMyLocationHistory
);

// ================
// ADMIN ROUTES
// ================

// Get all online partners with their locations (for live map view)
router.get(
    '/admin/partners/online',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getAllOnlinePartners
);

// Get location history for specific partner
router.get(
    '/admin/partners/:partnerId/location-history',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getPartnerLocationHistory
);

// Get location history for a booking
router.get(
    '/admin/bookings/:bookingId/location-history',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getBookingLocationHistory
);

// Get activity logs for a booking
router.get(
    '/admin/bookings/:bookingId/activity-logs',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getBookingActivityLogs
);

// Get all activity logs with filters
router.get(
    '/admin/activity-logs',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getAllActivityLogs
);

// ================
// CUSTOMER ROUTES
// ================

// Get tracking info for my booking
router.get(
    '/customer/bookings/:bookingId/tracking',
    authorize('CUSTOMER'),
    locationController.getCustomerBookingTracking
);

export default router;
