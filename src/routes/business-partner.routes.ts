import { Router } from 'express';
import { BusinessPartnerController } from '../controllers/business-partner.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const bpController = new BusinessPartnerController();

// All routes require authentication
router.use(authenticateToken);

// Business Partner specific management routes
router.get(
    '/:id/unified-customers',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    bpController.getUnifiedCustomers
);

router.get(
    '/:id/analytics',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    bpController.getAnalytics
);

router.post(
    '/:id/slots/generate',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    bpController.generateSlots
);

export default router;
