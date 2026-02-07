import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { serviceImageUpload, categoryIconUpload } from '../middleware/image-upload.middleware';
import {
    createServiceValidator,
    updateServiceValidator,
    createCategoryValidator,
} from '../validators/service.validator';

const router = Router();
const serviceController = new ServiceController();

// Public routes
router.get('/', serviceController.getAllServices);
router.get('/categories', serviceController.getAllCategories);
router.get('/:id', serviceController.getServiceById);

// Protected routes - Admin/Super Admin only
router.post(
    '/',
    authenticateToken,
    authorize('ADMIN', 'SUPER_ADMIN'),
    serviceImageUpload,
    validate(createServiceValidator),
    serviceController.createService
);

router.patch(
    '/:id',
    authenticateToken,
    authorize('ADMIN', 'SUPER_ADMIN', 'BUSINESS_PARTNER'),
    serviceImageUpload,
    validate(updateServiceValidator),
    serviceController.updateService
);

router.delete(
    '/:id',
    authenticateToken,
    authorize('SUPER_ADMIN'),
    serviceController.deleteService
);

// Category management - Admin only
router.post(
    '/categories',
    authenticateToken,
    authorize('ADMIN', 'SUPER_ADMIN'),
    categoryIconUpload,
    validate(createCategoryValidator),
    serviceController.createCategory
);

router.patch(
    '/categories/:id',
    authenticateToken,
    authorize('ADMIN', 'SUPER_ADMIN'),
    serviceController.updateCategory
);

// Location-based pricing - Admin only
router.get(
    '/:id/pricing',
    authenticateToken,
    authorize('ADMIN', 'SUPER_ADMIN'),
    serviceController.getServiceWithLocationPricing
);

router.post(
    '/:id/pricing',
    authenticateToken,
    authorize('ADMIN', 'SUPER_ADMIN'),
    serviceController.setLocationPricing
);

router.delete(
    '/:id/pricing/:pricingId',
    authenticateToken,
    authorize('ADMIN', 'SUPER_ADMIN'),
    serviceController.deleteLocationPricing
);

router.get(
    '/:id/price',
    serviceController.getServicePrice
);

export default router;

