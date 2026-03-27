import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, checkPermission } from '../middleware/auth.middleware';

const router = Router();
const adminController = new AdminController();

// All routes require authentication
router.use(authenticateToken);

// Get dashboard statistics
router.get('/dashboard/stats', checkPermission('REPORT_VIEW'), adminController.getDashboardStats);

// Partner Management
router.get('/partners/pending', checkPermission('KYC_MANAGE'), adminController.getPendingPartners);
router.patch('/partners/:id/status', checkPermission('USER_MANAGE'), adminController.togglePartnerStatus);
router.post('/partners/assign-category', checkPermission('USER_MANAGE'), adminController.assignPartnerCategory);
router.post('/partners/:id/approve', checkPermission('KYC_MANAGE'), adminController.approvePartner);
router.post('/partners/:id/reject', checkPermission('KYC_MANAGE'), adminController.rejectPartner);
router.post('/partners/:id/request-action', checkPermission('KYC_MANAGE'), adminController.requestAction);

// Category Management
router.post('/categories', checkPermission('SERVICE_MANAGE'), adminController.createCategory);
router.patch('/categories/:id', checkPermission('SERVICE_MANAGE'), adminController.updateCategory);

// Reports & Analytics
router.get('/reports', checkPermission('REPORT_VIEW'), adminController.generateReport);
router.get('/analytics', checkPermission('REPORT_VIEW'), adminController.getDashboardStats);

export default router;
