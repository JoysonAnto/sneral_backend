import { Router } from 'express';
import { KYCController } from '../controllers/kyc.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { kycFields } from '../middleware/upload.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const kycController = new KYCController();

// All routes require authentication
router.use(authenticateToken);

// Submit KYC documents (partners only)
router.post(
    '/submit',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    kycFields,
    kycController.submitKYC
);

// Get KYC status (self or admin)
router.get('/:partnerId', kycController.getKYCStatus);

// Verify KYC (admin only)
router.post(
    '/:partnerId/verify',
    authorize('ADMIN', 'SUPER_ADMIN'),
    validate([
        body('status')
            .notEmpty()
            .isIn(['APPROVED', 'REJECTED', 'ACTION_REQUIRED'])
            .withMessage('Status must be APPROVED, REJECTED or ACTION_REQUIRED'),
        body('reason')
            .optional()
            .trim()
            .isLength({ min: 10, max: 500 })
            .withMessage('Reason must be between 10 and 500 characters'),
    ]),
    kycController.verifyKYC
);

export default router;
