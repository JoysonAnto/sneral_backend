import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { ServiceController } from '../controllers/service.controller';
import { authenticateToken, checkPermission } from '../middleware/auth.middleware';
import { categoryIconUpload } from '../middleware/image-upload.middleware';

const router = Router();
const adminController = new AdminController();
const serviceController = new ServiceController();

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

// Category Management - Using ServiceController for robust logic (file upload, sanitization)
router.post(
    '/categories',
    checkPermission('SERVICE_MANAGE'),
    categoryIconUpload,
    serviceController.createCategory
);
router.patch(
    '/categories/:id',
    checkPermission('SERVICE_MANAGE'),
    categoryIconUpload,
    serviceController.updateCategory
);

// Reports & Analytics
router.get('/reports', checkPermission('REPORT_VIEW'), adminController.generateReport);
router.get('/analytics', checkPermission('REPORT_VIEW'), adminController.getDashboardStats);

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get all platform settings (commission rate, GST rate, etc.)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform settings retrieved
 *   put:
 *     summary: Update platform commission and GST settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commission_rate:
 *                 type: number
 *                 description: "0 to 1 (e.g. 0.15 = 15%)"
 *               gst_rate:
 *                 type: number
 *                 description: "0 to 1 (e.g. 0.18 = 18%)"
 *               gst_enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.get('/settings', checkPermission('REPORT_VIEW'), adminController.getPlatformSettings);
router.put('/settings', checkPermission('SERVICE_MANAGE'), adminController.updatePlatformSettings);

export default router;

