import { Router } from 'express';
import { OfflineInvoiceController } from '../controllers/offline-invoice.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const invoiceController = new OfflineInvoiceController();

// All routes require authentication and BUSINESS_PARTNER role
router.use(authenticateToken);
router.use(authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'));

// Invoice management for a specific business partner
router.get(
    '/business/:businessPartnerId/offline-invoices',
    invoiceController.getAllInvoices
);

router.post(
    '/business/:businessPartnerId/offline-invoices',
    invoiceController.createInvoice
);

// Analytics
router.get(
    '/business/:businessPartnerId/offline-invoices/analytics',
    invoiceController.getInvoiceAnalytics
);

// Individual invoice operations
router.get('/offline-invoices/:id', invoiceController.getInvoiceById);
router.patch('/offline-invoices/:id', invoiceController.updateInvoice);
router.delete('/offline-invoices/:id', invoiceController.deleteInvoice);

// Invoice actions
router.post('/offline-invoices/:id/send', invoiceController.sendInvoice);
router.post('/offline-invoices/:id/payments', invoiceController.recordPayment);
router.post('/offline-invoices/:id/cancel', invoiceController.cancelInvoice);

// Admin route to mark overdue invoices (can be called via cron)
router.post(
    '/offline-invoices/mark-overdue',
    authorize('ADMIN', 'SUPER_ADMIN'),
    invoiceController.markOverdueInvoices
);

// Download invoice as PDF
router.get('/offline-invoices/:id/pdf', invoiceController.downloadInvoicePDF);

export default router;
