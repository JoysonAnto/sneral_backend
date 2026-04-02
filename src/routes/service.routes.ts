import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import { authenticateToken, checkPermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { serviceImageUpload, categoryIconUpload } from '../middleware/image-upload.middleware';
import {
    createServiceValidator,
    updateServiceValidator,
    createCategoryValidator,
} from '../validators/service.validator';

const router = Router();
const serviceController = new ServiceController();

/**
 * @swagger
 * tags:
 *   name: Services & Categories
 *   description: Management of platform offerings, pricing, and classifications
 */

// Public routes
/**
 * @swagger
 * /services:
 *   get:
 *     summary: List all active services across the platform
 *     tags: [Services & Categories]
 *     responses:
 *       200:
 *         description: List of services retrieved
 */
router.get('/', serviceController.getAllServices);

/**
 * @swagger
 * /services/categories:
 *   get:
 *     summary: Retrieve all root and sub-categories
 *     tags: [Services & Categories]
 *     responses:
 *       200:
 *         description: Category tree returned
 */
router.get('/categories', serviceController.getAllCategories);

/**
 * @swagger
 * /services/{id}:
 *   get:
 *     summary: Detailed info for a specific service
 *     tags: [Services & Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Service details retrieved
 */
router.get('/:id', serviceController.getServiceById);

// Protected routes - Management
/**
 * @swagger
 * /services:
 *   post:
 *     summary: Create a new platform service (Admin)
 *     tags: [Services & Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Service created
 */
router.post(
    '/',
    authenticateToken,
    checkPermission('SERVICE_MANAGE'),
    serviceImageUpload,
    validate(createServiceValidator),
    serviceController.createService
);

/**
 * @swagger
 * /services/{id}:
 *   patch:
 *     summary: Update service metadata or base pricing (Admin/Partner)
 *     tags: [Services & Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Service updated
 */
router.patch(
    '/:id',
    authenticateToken,
    // Either have direct SERVICE_MANAGE permission OR be a BUSINESS_PARTNER (who handles their own prices)
    async (req: any, _res, next) => {
        if (req.user.role === 'BUSINESS_PARTNER' || (req.user.permissions || []).includes('SERVICE_MANAGE') || req.user.role === 'SUPER_ADMIN') {
            return next();
        }
        next(new Error('Access denied - missing SERVICE_MANAGE permission'));
    },
    serviceImageUpload,
    validate(updateServiceValidator),
    serviceController.updateService
);

router.delete(
    '/:id',
    authenticateToken,
    checkPermission('SERVICE_MANAGE'),
    serviceController.deleteService
);

// Category management - Admin only
router.post(
    '/categories',
    authenticateToken,
    checkPermission('SERVICE_MANAGE'),
    categoryIconUpload,
    validate(createCategoryValidator),
    serviceController.createCategory
);

router.patch(
    '/categories/:id',
    authenticateToken,
    checkPermission('SERVICE_MANAGE'),
    serviceController.updateCategory
);

// Location-based pricing - Admin only
router.get(
    '/:id/pricing',
    authenticateToken,
    checkPermission('SERVICE_MANAGE'),
    serviceController.getServiceWithLocationPricing
);

router.post(
    '/:id/pricing',
    authenticateToken,
    checkPermission('SERVICE_MANAGE'),
    serviceController.setLocationPricing
);

router.delete(
    '/:id/pricing/:pricingId',
    authenticateToken,
    checkPermission('SERVICE_MANAGE'),
    serviceController.deleteLocationPricing
);

/**
 * @swagger
 * /services/{id}/price:
 *   get:
 *     summary: Calculate price for a service given user location
 *     tags: [Services & Categories]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Calculated final price rule
 */
router.get(
    '/:id/price',
    serviceController.getServicePrice
);

export default router;

