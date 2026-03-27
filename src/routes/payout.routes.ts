import { Router } from 'express';
import { PayoutController } from '../controllers/payout.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const payoutController = new PayoutController();

/**
 * @swagger
 * tags:
 *   name: Wallet & Payouts
 *   description: Partner earnings management and bank transfers
 */

router.use(authenticateToken);

/**
 * @swagger
 * /payouts/request:
 *   post:
 *     summary: Request transfer of wallet balance to linked bank account
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, minimum: 500 }
 *     responses:
 *       200:
 *         description: Payout request submitted successfully
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
 *     summary: Track the status and history of my payout requests
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of previous payouts
 */
router.get(
    '/history',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    payoutController.getWithdrawalHistory
);

// Admin routes
/**
 * @swagger
 * /payouts/all:
 *   get:
 *     summary: View all pending and processed payout requests (Admin)
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all system payouts
 */
router.get(
    '/all',
    authorize('ADMIN', 'SUPER_ADMIN'),
    payoutController.getAllRequests
);

/**
 * @swagger
 * /payouts/{id}/process:
 *   post:
 *     summary: Process (Approve/Reject) a payout request (Admin)
 *     tags: [Wallet & Payouts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payout processed successfully
 */
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
