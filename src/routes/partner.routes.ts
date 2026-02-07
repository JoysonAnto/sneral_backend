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

// All routes require authentication
router.use(authenticateToken);

// List partners (admin only)
router.get(
    '/',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getAllPartners
);

// Create service partner (business partner or admin)
router.post(
    '/',
    authorize('ADMIN', 'SUPER_ADMIN', 'BUSINESS_PARTNER'),
    validate(createPartnerValidator),
    partnerController.createServicePartner
);

// Get partner details (self, admin, or business partner)
router.get('/:id', partnerController.getPartnerById);

// Update partner profile
router.patch(
    '/:id',
    validate(updatePartnerValidator),
    partnerController.updatePartner
);

// Get partner services
router.get('/:id/services', partnerController.getPartnerServices);

// Update partner service pricing/availability
router.patch(
    '/:id/services',
    validate(updatePartnerServiceValidator),
    partnerController.updatePartnerService
);

// Get partner bookings
router.get('/:id/bookings', partnerController.getPartnerBookings);

// Get partner earnings
router.get('/:id/earnings', partnerController.getPartnerEarnings);

// Update availability (service partner only)
router.patch(
    '/me/availability',
    authorize('SERVICE_PARTNER'),
    validate(updateAvailabilityValidator),
    partnerController.updateAvailability
);

// ================
// ENHANCEMENT ROUTES
// ================

// Performance Analytics
router.get(
    '/:id/performance',
    authorize('ADMIN', 'SUPER_ADMIN'),
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

// Partner Analytics Aggregation
router.get(
    '/analytics',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getPartnersAnalytics
);

// Top Performers
router.get(
    '/analytics/top-performers',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getTopPerformers
);

// Commission Report
router.get(
    '/analytics/commission-report',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getCommissionReport
);

// Analytics Trends
router.get(
    '/analytics/trends',
    authorize('ADMIN', 'SUPER_ADMIN'),
    partnerController.getAnalyticsTrends
);

// ================
// BOOKING ACTIONS (Service Partner)
// ================

// Accept a booking (Ola-like flow)
router.post(
    '/bookings/:bookingId/accept',
    authorize('SERVICE_PARTNER'),
    partnerController.acceptBooking
);

// Reject a booking
router.post(
    '/bookings/:bookingId/reject',
    authorize('SERVICE_PARTNER'),
    partnerController.rejectBooking
);

export default router;


