import { Router } from 'express';
import { OfflineInvoiceController } from '../controllers/offline-invoice.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const invoiceController = new OfflineInvoiceController();

// All routes require authentication and BUSINESS_PARTNER role
router.use(authenticateToken);
// Invoice management for a specific business partner
router.get(
    '/business/:businessPartnerId/offline-invoices',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    invoiceController.getAllInvoices
);

router.post(
    '/business/:businessPartnerId/offline-invoices',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    invoiceController.createInvoice
);

// Analytics
router.get(
    '/business/:businessPartnerId/offline-invoices/analytics',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    invoiceController.getInvoiceAnalytics
);

// Individual invoice operations
router.get('/offline-invoices/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), invoiceController.getInvoiceById);
router.patch('/offline-invoices/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), invoiceController.updateInvoice);
router.delete('/offline-invoices/:id', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), invoiceController.deleteInvoice);

// Invoice actions
router.post('/offline-invoices/:id/send', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), invoiceController.sendInvoice);
router.post('/offline-invoices/:id/payments', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), invoiceController.recordPayment);
router.post('/offline-invoices/:id/cancel', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), invoiceController.cancelInvoice);

// Admin route to mark overdue invoices (can be called via cron)
router.post(
    '/offline-invoices/mark-overdue',
    authorize('ADMIN', 'SUPER_ADMIN'),
    invoiceController.markOverdueInvoices
);

// Download invoice as PDF
router.get('/offline-invoices/:id/pdf', authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'), invoiceController.downloadInvoicePDF);

export default router;
