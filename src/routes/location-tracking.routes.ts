import { Router } from 'express';
import { LocationTrackingController } from '../controllers/location-tracking.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const locationController = new LocationTrackingController();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * tags:
 *   name: Real-time Tracking & Alerts
 *   description: LIVE GPS tracking for partners and customers
 */

// All routes require authentication
router.use(authenticateToken);

// ================
// PARTNER ROUTES
// ================

/**
 * @swagger
 * /tracking/partner/location:
 *   post:
 *     summary: Submit GPS coordinates (Every 30-60s) for the live map
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lat
 *               - lng
 *             properties:
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location updated
 */
router.post(
    '/partner/location',
    authorize('SERVICE_PARTNER'),
    locationController.updateLocation
);

/**
 * @swagger
 * /tracking/partner/location/history:
 *   get:
 *     summary: Get my own recent location history
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Location history entries
 */
router.get(
    '/partner/location/history',
    authorize('SERVICE_PARTNER'),
    locationController.getMyLocationHistory
);

// ================
// ADMIN ROUTES
// ================

/**
 * @swagger
 * /tracking/admin/partners/online:
 *   get:
 *     summary: Get all online partners for the Admin Live Map
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of online partners with last known GPS
 */
router.get(
    '/admin/partners/online',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getAllOnlinePartners
);

/**
 * @swagger
 * /tracking/admin/partners/{partnerId}/location-history:
 *   get:
 *     summary: Get location audit trail for a specific partner
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historical breadcrumbs
 */
router.get(
    '/admin/partners/:partnerId/location-history',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getPartnerLocationHistory
);

/**
 * @swagger
 * /tracking/admin/bookings/{bookingId}/location-history:
 *   get:
 *     summary: Get path taken by partner during a specific booking
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historical breadcrumbs for the job
 */
router.get(
    '/admin/bookings/:bookingId/location-history',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getPartnerLocationHistory
);

/**
 * @swagger
 * /tracking/admin/bookings/{bookingId}/activity-logs:
 *   get:
 *     summary: Get system events log for a specific booking
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of lifecycle events
 */
router.get(
    '/admin/bookings/:bookingId/activity-logs',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getBookingActivityLogs
);

/**
 * @swagger
 * /tracking/admin/activity-logs:
 *   get:
 *     summary: Global activity log viewer with filters
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filtered activity logs
 */
router.get(
    '/admin/activity-logs',
    authorize('ADMIN', 'SUPER_ADMIN'),
    locationController.getAllActivityLogs
);

// ================
// CUSTOMER ROUTES
// ================

/**
 * @swagger
 * /tracking/customer/bookings/{bookingId}/tracking:
 *   get:
 *     summary: Live tracking of the assigned partner (Customer View)
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current partner location for the booking
 */
router.get(
    '/customer/bookings/:bookingId/tracking',
    authorize('CUSTOMER'),
    locationController.getCustomerBookingTracking
);

export default router;
