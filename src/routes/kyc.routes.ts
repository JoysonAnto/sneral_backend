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

/**
 * @swagger
 * /kyc/submit:
 *   post:
 *     summary: Upload Aadhaar, PAN, and Bank details
 *     tags: [KYC & Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               aadhaar_front:
 *                 type: string
 *                 format: binary
 *               aadhaar_back:
 *                 type: string
 *                 format: binary
 *               pan_card:
 *                 type: string
 *                 format: binary
 *               bank_passbook:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: KYC submitted successfully
 */
router.post(
    '/submit',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    kycFields,
    kycController.submitKYC
);

/**
 * @swagger
 * /kyc/{partnerId}:
 *   get:
 *     summary: Check KYC status
 *     tags: [KYC & Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *     responses:
 *       200:
 *         description: KYC status returned
 */
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
