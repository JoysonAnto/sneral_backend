import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { ServiceController } from '../controllers/service.controller';
import { PartnerController } from '../controllers/partner.controller';
import { authenticateToken, checkPermission } from '../middleware/auth.middleware';
import { categoryIconUpload } from '../middleware/image-upload.middleware';
import { kycUpload } from '../middleware/upload.middleware';

const router = Router();
const adminController = new AdminController();
const serviceController = new ServiceController();
const partnerController = new PartnerController();

// All routes require authentication
router.use(authenticateToken);

// Get dashboard statistics
router.get('/dashboard/stats', checkPermission('REPORT_VIEW'), adminController.getDashboardStats);

// Partner Management
router.get('/partners', checkPermission('USER_MANAGE'), partnerController.getAllPartners);
router.post('/partners', checkPermission('USER_MANAGE'), partnerController.createServicePartner);
router.get('/partners/pending', checkPermission('KYC_MANAGE'), adminController.getPendingPartners);
router.get('/partners/:id', checkPermission('USER_MANAGE'), partnerController.getPartnerById);
router.put('/partners/:id', checkPermission('USER_MANAGE'), partnerController.updatePartner);
router.patch('/partners/:id/status', checkPermission('USER_MANAGE'), adminController.togglePartnerStatus);
router.get('/partners/:id/history', checkPermission('USER_MANAGE'), partnerController.getPartnerHistory);
router.post('/partners/:id/documents', checkPermission('KYC_MANAGE'), kycUpload.single('file'), partnerController.uploadPartnerDocument);
router.get('/partners/:id/documents', checkPermission('KYC_MANAGE'), partnerController.getPartnerDocuments);
router.patch('/partners/documents/:id/verify', checkPermission('KYC_MANAGE'), partnerController.verifyPartnerDocument);
router.delete('/partners/documents/:id', checkPermission('KYC_MANAGE'), partnerController.deletePartnerDocument);
router.post('/partners/assign-category', checkPermission('USER_MANAGE'), adminController.assignPartnerCategory);
router.post('/partners/:id/approve', checkPermission('KYC_MANAGE'), adminController.approvePartner);
router.post('/partners/:id/reject', checkPermission('KYC_MANAGE'), adminController.rejectPartner);
router.post('/partners/:id/request-action', checkPermission('KYC_MANAGE'), adminController.requestAction);

// Catalogue Management - Services & Categories
router.get(
    '/categories',
    checkPermission('SERVICE_MANAGE'),
    serviceController.getAllCategories
);
router.get(
    '/services',
    checkPermission('SERVICE_MANAGE'),
    serviceController.getAllServices
);
router.get(
    '/services/repeated',
    checkPermission('SERVICE_MANAGE'),
    serviceController.getRepeatedServices
);
router.post(
    '/services/repeated',
    checkPermission('SERVICE_MANAGE'),
    serviceController.updateRepeatedServicesBulk
);
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

// ============================================
// SURGE AREAS MANAGEMENT
// ============================================
import { adminManagementController } from '../controllers/admin-management.controller';

router.get('/surge-areas', checkPermission('SERVICE_MANAGE'), adminManagementController.getSurgeAreas);
router.post('/surge-areas', checkPermission('SERVICE_MANAGE'), adminManagementController.createSurgeArea);
router.patch('/surge-areas/:id', checkPermission('SERVICE_MANAGE'), adminManagementController.updateSurgeArea);
router.delete('/surge-areas/:id', checkPermission('SERVICE_MANAGE'), adminManagementController.deleteSurgeArea);

// ============================================
// MILESTONE REWARDS MANAGEMENT
// ============================================
router.get('/rewards/rules', checkPermission('SERVICE_MANAGE'), adminManagementController.getRewardRules);
router.post('/rewards/rules', checkPermission('SERVICE_MANAGE'), adminManagementController.createRewardRule);
router.patch('/rewards/rules/:id', checkPermission('SERVICE_MANAGE'), adminManagementController.updateRewardRule);
router.delete('/rewards/rules/:id', checkPermission('SERVICE_MANAGE'), adminManagementController.deleteRewardRule);
router.get('/rewards/claims', checkPermission('REPORT_VIEW'), adminManagementController.getRewardClaims);

// ============================================
// REFERRAL PROGRAM MANAGEMENT
// ============================================
router.get('/referrals/config', checkPermission('SERVICE_MANAGE'), adminManagementController.getReferralConfig);
router.put('/referrals/config', checkPermission('SERVICE_MANAGE'), adminManagementController.updateReferralConfig);
router.get('/referrals/logs', checkPermission('REPORT_VIEW'), adminManagementController.getReferralLogs);

// ============================================
// AGENCY / BUSINESS PARTNER FLEET
// ============================================
router.get('/agencies', checkPermission('USER_MANAGE'), adminManagementController.getAgencies);
router.post('/agencies', checkPermission('USER_MANAGE'), adminManagementController.createAgency);
router.patch('/agencies/:id', checkPermission('USER_MANAGE'), adminManagementController.updateAgency);
router.delete('/agencies/:id', checkPermission('USER_MANAGE'), adminManagementController.deleteAgency);
router.get('/agencies/:id/technicians', checkPermission('USER_MANAGE'), adminManagementController.getAgencyTechnicians);
router.post('/agencies/:id/technicians', checkPermission('USER_MANAGE'), adminManagementController.linkTechnicianToAgency);

// ============================================
// MERCHANDISE & EQUIPMENT STORE
// ============================================
router.get('/merchandise', checkPermission('SERVICE_MANAGE'), adminManagementController.getMerchandiseKits);
router.post('/merchandise', checkPermission('SERVICE_MANAGE'), adminManagementController.createMerchandiseKit);
router.put('/merchandise/:id', checkPermission('SERVICE_MANAGE'), adminManagementController.updateMerchandiseKit);
router.delete('/merchandise/:id', checkPermission('SERVICE_MANAGE'), adminManagementController.deleteMerchandiseKit);
router.get('/merchandise/orders', checkPermission('REPORT_VIEW'), adminManagementController.getMerchandiseOrders);
router.patch('/merchandise/orders/:id/status', checkPermission('SERVICE_MANAGE'), adminManagementController.updateMerchandiseOrderStatus);

export default router;

