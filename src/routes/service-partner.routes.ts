import { Router } from 'express';
import { PartnerController } from '../controllers/partner.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { successResponse } from '../utils/response';

const router = Router();
const partnerController = new PartnerController();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /partner/availability:
 *   patch:
 *     summary: Set status to ONLINE or OFFLINE
 *     tags: [Service & Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ONLINE, OFFLINE]
 *     responses:
 *       200:
 *         description: Availability updated
 */
router.patch(
    '/availability',
    authorize('SERVICE_PARTNER'),
    partnerController.updateAvailability
);

router.patch(
    '/me/availability',
    authorize('SERVICE_PARTNER'),
    partnerController.updateAvailability
);

/**
 * @swagger
 * /partner/services:
 *   get:
 *     summary: List services currently offered by the partner
 *     tags: [Service & Availability]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of partner services
 */
router.get(
    '/services',
    authorize('SERVICE_PARTNER'),
    async (req, res, next) => {
        try {
            const userId = (req as any).user.userId;
            console.log(`🔍 [DEBUG] Fetching services for Partner UserID: ${userId}`);

            const servicePartner = await prisma.servicePartner.findUnique({
                where: { user_id: userId },
                include: {
                    services: {
                        include: {
                            service: true
                        }
                    }
                }
            });

            if (!servicePartner) {
                console.log(`❌ [DEBUG] Service partner not found for UserID: ${userId}`);
                return res.status(404).json({ success: false, message: 'Service partner not found' });
            }

            console.log(`✅ [DEBUG] Found ${servicePartner.services.length} services for partner ${servicePartner.id}`);
            return res.json(successResponse(servicePartner.services, 'Services retrieved successfully'));
        } catch (error) {
            console.error('🔥 [DEBUG] Error in /partner/services:', error);
            return next(error);
        }
    }
);

/**
 * @swagger
 * /partner/services/sync:
 *   post:
 *     summary: Link new services from the platform to the partner profile
 *     tags: [Service & Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serviceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Services synced
 */
router.post(
    '/services/sync',
    authorize('SERVICE_PARTNER'),
    async (req, res, next) => {
        try {
            const userId = (req as any).user.userId;
            const { serviceIds } = req.body;

            const servicePartner = await prisma.servicePartner.findUnique({
                where: { user_id: userId }
            });

            if (!servicePartner) {
                return res.status(404).json({ success: false, message: 'Service partner not found' });
            }

            // Delete existing services
            await prisma.partnerService.deleteMany({
                where: { partner_id: servicePartner.id }
            });

            // Add new services
            if (serviceIds && serviceIds.length > 0) {
                await prisma.partnerService.createMany({
                    data: serviceIds.map((serviceId: string) => ({
                        partner_id: servicePartner.id,
                        service_id: serviceId,
                        is_available: true
                    }))
                });
            }

            // Get updated services
            const updatedServices = await prisma.partnerService.findMany({
                where: { partner_id: servicePartner.id },
                include: {
                    service: {
                        include: {
                            category: true
                        }
                    }
                }
            });

            return res.json(successResponse(updatedServices, 'Services synced successfully'));
        } catch (error) {
            return next(error);
        }
    }
);

export default router;
