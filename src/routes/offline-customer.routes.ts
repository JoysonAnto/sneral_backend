import { Router } from 'express';
import { OfflineCustomerController } from '../controllers/offline-customer.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const customerController = new OfflineCustomerController();

// All routes require authentication and BUSINESS_PARTNER role
router.use(authenticateToken);
router.use(authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'));

// Customer management for a specific business partner
router.get(
    '/business/:businessPartnerId/offline-customers',
    customerController.getAllCustomers
);

router.post(
    '/business/:businessPartnerId/offline-customers',
    customerController.createCustomer
);

// Individual customer operations
router.get('/offline-customers/:id', customerController.getCustomerById);
router.patch('/offline-customers/:id', customerController.updateCustomer);
router.delete('/offline-customers/:id', customerController.deleteCustomer);

// Customer statistics
router.get('/offline-customers/:id/stats', customerController.getCustomerStats);

export default router;
