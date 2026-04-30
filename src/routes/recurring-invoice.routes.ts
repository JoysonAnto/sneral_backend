import { Router } from 'express';
import { RecurringInvoiceController } from '../controllers/recurring-invoice.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const recurringController = new RecurringInvoiceController();

// All routes require authentication
router.use(authenticateToken);
// Recurring invoice management for a specific business partner
router.get(
    '/business/:businessPartnerId/recurring-invoices',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    recurringController.getAllRecurring
);

router.post(
    '/business/:businessPartnerId/recurring-invoices',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    recurringController.createRecurring
);

// Individual recurring invoice operations
router.get('/recurring-invoices/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), recurringController.getRecurringById);
router.patch('/recurring-invoices/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), recurringController.updateRecurring);
router.delete('/recurring-invoices/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), recurringController.deleteRecurring);

// Status management
router.post('/recurring-invoices/:id/pause', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), recurringController.pauseRecurring);
router.post('/recurring-invoices/:id/resume', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), recurringController.resumeRecurring);
router.post('/recurring-invoices/:id/cancel', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), recurringController.cancelRecurring);

// Admin route to generate invoices (can be called via cron)
router.post(
    '/recurring-invoices/generate',
    authorize('ADMIN', 'SUPER_ADMIN'),
    recurringController.generateInvoices
);

export default router;
