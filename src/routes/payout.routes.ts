import { Router } from 'express';
import { PayoutController } from '../controllers/payout.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const payoutController = new PayoutController();

router.use(authenticateToken);

/**
 * @swagger
 * /payouts/request:
 *   post:
 *     summary: Transfer wallet balance to bank account (Min ₹500)
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 500
 *     responses:
 *       200:
 *         description: Payout request submitted
 */
router.post(
    '/request',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    validate([
        body('amount').isNumeric().withMessage('Amount must be a number')
            .custom((value) => value >= 500).withMessage('Minimum amount is ₹500'),
    ]),
    payoutController.requestWithdrawal
);

/**
 * @swagger
 * /payouts/history:
 *   get:
 *     summary: Track the status of bank transfers
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payout history
 */
router.get(
    '/history',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    payoutController.getWithdrawalHistory
);

// Admin routes
router.get(
    '/all',
    authorize('ADMIN', 'SUPER_ADMIN'),
    payoutController.getAllRequests
);

router.post(
    '/:id/process',
    authorize('ADMIN', 'SUPER_ADMIN'),
    validate([
        body('status').isIn(['APPROVED', 'REJECTED', 'COMPLETED', 'FAILED'])
            .withMessage('Invalid status'),
        body('notes').optional().trim(),
    ]),
    payoutController.processWithdrawal
);

export default router;
