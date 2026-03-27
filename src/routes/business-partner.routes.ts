import { Router } from 'express';
import { BusinessPartnerController } from '../controllers/business-partner.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const bpController = new BusinessPartnerController();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * tags:
 *   name: Business Partners
 *   description: Management and analytics for business entities
 */

// Business Partner specific management routes
/**
 * @swagger
 * /business-partners/{id}/unified-customers:
 *   get:
 *     summary: View all customers associated with this business entity
 *     tags: [Business Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unified customers
 */
router.get(
    '/:id/unified-customers',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    bpController.getUnifiedCustomers
);

/**
 * @swagger
 * /business-partners/{id}/analytics:
 *   get:
 *     summary: Get high-level business performance metrics
 *     tags: [Business Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business analytics data
 */
router.get(
    '/:id/analytics',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    bpController.getAnalytics
);

/**
 * @swagger
 * /business-partners/{id}/slots/generate:
 *   post:
 *     summary: Bulk generate available service slots
 *     tags: [Business Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Slots generated successfully
 */
router.post(
    '/:id/slots/generate',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    bpController.generateSlots
);

export default router;
