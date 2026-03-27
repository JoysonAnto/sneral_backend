import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import { LocationTrackingController } from '../controllers/location-tracking.controller';

const router = Router();
const serviceController = new ServiceController();
const locationController = new LocationTrackingController();

/**
 * @swagger
 * /public/categories:
 *   get:
 *     summary: Get all active categories
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/categories', serviceController.getAllCategories);

/**
 * @swagger
 * /public/services/featured:
 *   get:
 *     summary: Get featured services
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of featured services
 */
router.get('/services/featured', serviceController.getFeaturedServices);

/**
 * @swagger
 * /public/services/popular:
 *   get:
 *     summary: Get popular services
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of popular services
 */
router.get('/services/popular', serviceController.getPopularServices);

/**
 * @swagger
 * /public/partners/nearby:
 *   get:
 *     summary: Get nearby available partners (Discovery Map)
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *       - in: query
 *         name: lng
 *         required: true
 *     responses:
 *       200:
 *         description: List of nearby partners
 */
router.get('/partners/nearby', locationController.getNearbyPartners);

export default router;
