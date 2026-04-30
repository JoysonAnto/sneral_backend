import { Router } from 'express';
import { OfflineCustomerController } from '../controllers/offline-customer.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const customerController = new OfflineCustomerController();

// All routes require authentication and BUSINESS_PARTNER role
router.use(authenticateToken);
// Customer management for a specific business partner
router.get(
    '/business/:businessPartnerId/offline-customers',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    customerController.getAllCustomers
);

router.post(
    '/business/:businessPartnerId/offline-customers',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    customerController.createCustomer
);

// Individual customer operations
router.get('/offline-customers/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), customerController.getCustomerById);
router.patch('/offline-customers/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), customerController.updateCustomer);
router.delete('/offline-customers/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), customerController.deleteCustomer);

// Customer statistics
router.get('/offline-customers/:id/stats', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), customerController.getCustomerStats);

export default router;
