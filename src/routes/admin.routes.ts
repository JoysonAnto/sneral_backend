import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const adminController = new AdminController();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Get dashboard statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

// Partner Management
router.get('/partners/pending', adminController.getPendingPartners);
router.patch('/partners/:id/status', adminController.togglePartnerStatus);
router.post('/partners/:id/approve', adminController.approvePartner);
router.post('/partners/:id/reject', adminController.rejectPartner);
router.post('/partners/:id/request-action', adminController.requestAction);

// Category Management
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);

export default router;
