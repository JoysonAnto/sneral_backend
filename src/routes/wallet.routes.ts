import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const walletController = new WalletController();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /wallet:
 *   get:
 *     summary: View current balance, total earnings, and withdrawal limits
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance returned
 */
router.get('/', walletController.getBalance);

/**
 * @swagger
 * /wallet/stats:
 *   get:
 *     summary: Wallet summary (total earned, payouts, balance)
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet stats returned
 */
router.get('/stats', walletController.getStats);

/**
 * @swagger
 * /wallet/add-money:
 *   post:
 *     summary: Top up wallet balance
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Money added successfully
 */
router.post(
    '/add-money',
    validate([
        body('amount')
            .notEmpty()
            .isFloat({ min: 10 })
            .withMessage('Amount must be at least ₹10'),
        body('method')
            .notEmpty()
            .isIn(['UPI', 'CARD', 'NET_BANKING'])
            .withMessage('Invalid payment method'),
    ]),
    walletController.addMoney
);

/**
 * @swagger
 * /wallet/withdraw:
 *   post:
 *     summary: Withdraw from wallet (partners only)
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal successful
 */
router.post(
    '/withdraw',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    validate([
        body('amount')
            .notEmpty()
            .isFloat({ min: 100 })
            .withMessage('Minimum withdrawal amount is ₹100'),
        body('bankAccountId')
            .optional()
            .isUUID()
            .withMessage('Invalid bank account ID'),
    ]),
    walletController.withdraw
);

/**
 * @swagger
 * /wallet/transactions:
 *   get:
 *     summary: Detailed ledger of all credits (jobs) and debits (commissions)
 *     tags: [Wallet & Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction history
 */
router.get('/transactions', walletController.getTransactions);

export default router;
