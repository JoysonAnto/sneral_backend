import { Router } from 'express';
import { PartnerController } from '../controllers/partner.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
    createPartnerValidator,
    updatePartnerValidator,
    updateAvailabilityValidator,
    updatePartnerServiceValidator,
} from '../validators/partner.validator';

const router = Router();
const partnerController = new PartnerController();

/**
 * @swagger
 * tags:
 *   - name: Partners
 *     description: Service Partner and Business Partner management
 *   - name: Partner Analytics
 *     description: Performance metrics and earnings for partners
 */

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /partners:
 *   get:
 *     summary: List all partners
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of partners retrieved successfully
 */
router.get(
    '/',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getAllPartners
);

/**
 * @swagger
 * /partners:
 *   post:
 *     summary: Create a new service partner
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - phoneNumber
 *               - categoryId
 *             properties:
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               categoryId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Partner created successfully
 */
router.post(
    '/',
    authorize('ADMIN', 'SUPER_ADMIN', 'BUSINESS_PARTNER'),
    validate(createPartnerValidator),
    partnerController.createServicePartner
);

/**
 * @swagger
 * /partners/{id}:
 *   get:
 *     summary: Get partner details by ID
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner details retrieved successfully
 */
router.get('/:id', partnerController.getPartnerById);

/**
 * @swagger
 * /partners/{id}:
 *   patch:
 *     summary: Update partner profile
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner profile updated successfully
 */
router.patch(
    '/:id',
    validate(updatePartnerValidator),
    partnerController.updatePartner
);

/**
 * @swagger
 * /partners/{id}/services:
 *   get:
 *     summary: Get services offered by a partner
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner services retrieved successfully
 */
router.get('/:id/services', partnerController.getPartnerServices);

/**
 * @swagger
 * /partners/{id}/services:
 *   patch:
 *     summary: Update partner service pricing or availability
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner service updated successfully
 */
router.patch(
    '/:id/services',
    validate(updatePartnerServiceValidator),
    partnerController.updatePartnerService
);

/**
 * @swagger
 * /partners/{id}/bookings:
 *   get:
 *     summary: Retrieve bookings assigned to a partner
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner bookings retrieved successfully
 */
router.get('/:id/bookings', partnerController.getPartnerBookings);

/**
 * @swagger
 * /partners/{id}/earnings:
 *   get:
 *     summary: Retrieve total earnings for a partner
 *     tags: [Partner Analytics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner earnings retrieved successfully
 */
router.get('/:id/earnings', partnerController.getPartnerEarnings);

/**
 * @swagger
 * /partners/me/availability:
 *   patch:
 *     summary: Update availability for the authenticated partner
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability updated successfully
 */
router.patch(
    '/me/availability',
    authorize('SERVICE_PARTNER'),
    validate(updateAvailabilityValidator),
    partnerController.updateAvailability
);

// ================
// ENHANCEMENT ROUTES
// ================

/**
 * @swagger
 * /partners/{id}/performance:
 *   get:
 *     summary: Get performance metrics for a partner
 *     tags: [Partner Analytics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner performance retrieved successfully
 */
router.get(
    '/:id/performance',
    authorize('ADMIN', 'SUPER_ADMIN', 'SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    partnerController.getPartnerPerformance
);

// Team Management (Business Partners)
router.get(
    '/business/:id/team',
    authorize('ADMIN', 'SUPER_ADMIN', 'BUSINESS_PARTNER'),
    partnerController.getTeamMembers
);

router.post(
    '/business/:id/team',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.addTeamMember
);

router.delete(
    '/business/:id/team/:memberId',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.removeTeamMember
);

router.get(
    '/business/:id/team/performance',
    authorize('ADMIN', 'SUPER_ADMIN', 'BUSINESS_PARTNER'),
    partnerController.getTeamPerformance
);

// Service Assignment
router.post(
    '/:id/assign-service',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.assignServiceToPartner
);

// Bulk Service Assignment
router.post(
    '/bulk/assign-services',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.bulkAssignServices
);

// Commission Management
router.patch(
    '/business/:id/commission',
    authorize('SUPER_ADMIN'),
    partnerController.updateCommissionRate
);

router.get(
    '/business/:id/commission/history',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getCommissionHistory
);

// ================
// PHASE 2: ANALYTICS ROUTES
// ================

/**
 * @swagger
 * /partners/analytics:
 *   get:
 *     summary: Get aggregated analytics for all partners
 *     tags: [Partner Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Partners analytics retrieved successfully
 */
router.get(
    '/analytics',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getPartnersAnalytics
);

/**
 * @swagger
 * /partners/analytics/top-performers:
 *   get:
 *     summary: Retrieve list of top performing partners
 *     tags: [Partner Analytics]
 *     responses:
 *       200:
 *         description: Top performers retrieved successfully
 */
router.get(
    '/analytics/top-performers',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getTopPerformers
);

/**
 * @swagger
 * /partners/analytics/commission-report:
 *   get:
 *     summary: Generate a report of all commissions
 *     tags: [Partner Analytics]
 *     responses:
 *       200:
 *         description: Commission report generated successfully
 */
router.get(
    '/analytics/commission-report',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getCommissionReport
);

/**
 * @swagger
 * /partners/analytics/trends:
 *   get:
 *     summary: Get growth and performance trends
 *     tags: [Partner Analytics]
 *     responses:
 *       200:
 *         description: Analytics trends retrieved successfully
 */
router.get(
    '/analytics/trends',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getAnalyticsTrends
);

// ================
// BOOKING ACTIONS (Service Partner)
// ================

/**
 * @swagger
 * /partners/bookings/{bookingId}/accept:
 *   post:
 *     summary: Accept an incoming booking request
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking accepted successfully
 */
router.post(
    '/bookings/:bookingId/accept',
    authorize('SERVICE_PARTNER'),
    partnerController.acceptBooking
);

/**
 * @swagger
 * /partners/bookings/{bookingId}/reject:
 *   post:
 *     summary: Reject an incoming booking request
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking rejected successfully
 */
router.post(
    '/bookings/:bookingId/reject',
    authorize('SERVICE_PARTNER'),
    partnerController.rejectBooking
);

export default router;


