import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const paymentController = new PaymentController();

// Webhook (no auth required)
router.post('/webhook/razorpay', paymentController.handleRazorpayWebhook);

// All other routes require authentication
router.use(authenticateToken);

// Create payment (customers only)
router.post(
    '/',
    authorize('CUSTOMER'),
    validate([
        body('bookingId').notEmpty().isUUID(),
        body('amount').notEmpty().isFloat({ min: 1 }),
        body('method').notEmpty().isIn(['RAZORPAY', 'STRIPE', 'WALLET']),
        body('type').notEmpty().isIn(['ADVANCE', 'FULL']),
    ]),
    paymentController.createPayment
);

// Verify payment (customers only)
router.post(
    '/verify',
    authorize('CUSTOMER'),
    validate([
        body('paymentId').notEmpty().isUUID(),
        body('razorpayOrderId').notEmpty(),
        body('razorpayPaymentId').notEmpty(),
        body('signature').notEmpty(),
    ]),
    paymentController.verifyPayment
);

// Process refund (admin only)
router.post(
    '/refund',
    authorize('ADMIN', 'SUPER_ADMIN'),
    validate([
        body('bookingId').notEmpty().isUUID(),
        body('amount').notEmpty().isFloat({ min: 1 }),
        body('reason').notEmpty().trim().isLength({ min: 10, max: 500 }),
    ]),
    paymentController.processRefund
);

// Get payment history
router.get('/history', paymentController.getPaymentHistory);

export default router;
