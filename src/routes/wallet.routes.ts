import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const walletController = new WalletController();

// All routes require authentication
router.use(authenticateToken);

// Get wallet balance
router.get('/', walletController.getBalance);

// Add money to wallet
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

// Withdraw from wallet (partners only)
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

// Get wallet transactions
router.get('/transactions', walletController.getTransactions);

export default router;
