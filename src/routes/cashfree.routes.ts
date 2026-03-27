import { Router } from 'express';
import { CashfreeController } from '../controllers/cashfree.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const cashfreeController = new CashfreeController();

// All routes require authentication and partner role
router.use(authenticateToken);
router.use(authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'));

/**
 * @swagger
 * /kyc/cashfree/generate-link:
 *   post:
 *     summary: Generate a Cashfree KYC Link for user verification
 *     tags: [KYC Cashfree]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               partnerId:
 *                 type: string
 *               phone:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 */
router.post(
    '/generate-link',
    validate([
        body('phone').notEmpty().withMessage('Phone number is required'),
    ]),
    cashfreeController.generateKYCLink
);

/**
 * @swagger
 * /kyc/cashfree/status/{verificationId}:
 *   get:
 *     summary: Check the status of a KYC verification link
 *     tags: [KYC Cashfree]
 *     parameters:
 *       - in: path
 *         name: verificationId
 *         required: true
 *         schema:
 *           type: string
 */
router.get(
    '/status/:verificationId',
    validate([
        param('verificationId').notEmpty().withMessage('Verification ID is required')
    ]),
    cashfreeController.getKYCStatus
);

export default router;
