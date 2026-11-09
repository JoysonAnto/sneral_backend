import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { referralService } from '../services/referral.service';
import { successResponse } from '../utils/response';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /referral:
 *   get:
 *     summary: Get current user referral info, code, stats, and referred customers progress
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral info retrieved successfully
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const info = await referralService.getUserReferralInfo(userId);
        res.json(successResponse(info, 'Referral info retrieved successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /referral/apply:
 *   post:
 *     summary: Apply a referral code to attribute the user to a referrer
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referralCode
 *             properties:
 *               referralCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Referral code applied successfully
 */
router.post('/apply', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { referralCode } = req.body;
        const tracking = await referralService.applyReferralCode(userId, referralCode);
        res.json(successResponse(tracking, 'Referral code applied successfully'));
    } catch (error) {
        next(error);
    }
});

export default router;
