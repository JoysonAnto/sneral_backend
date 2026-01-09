import { Router } from 'express';
import { PayoutController } from '../controllers/payout.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const payoutController = new PayoutController();

router.use(authenticateToken);

// Partner routes
router.post(
    '/request',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    validate([
        body('amount').isNumeric().withMessage('Amount must be a number')
            .custom((value) => value >= 500).withMessage('Minimum amount is ₹500'),
    ]),
    payoutController.requestWithdrawal
);

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
