import { Router } from 'express';
import { KYCController } from '../controllers/kyc.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { kycFields } from '../middleware/upload.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const kycController = new KYCController();

/**
 * @swagger
 * tags:
 *   name: KYC & Onboarding
 *   description: Partner identity verification and document management
 */

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /kyc/submit:
 *   post:
 *     summary: Upload Aadhaar, PAN, and Bank details for verification
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
 *     summary: Check the KYC verification status of a partner
 *     tags: [KYC & Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Current KYC status returned
 */
router.get('/:partnerId', kycController.getKYCStatus);

/**
 * @swagger
 * /kyc/{partnerId}/verify:
 *   post:
 *     summary: Approve or reject KYC documents (Admin only)
 *     tags: [KYC & Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status updated
 */
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

// Compatibility with Frontend Admin Dashboard
router.patch('/:partnerId/approve', authorize('ADMIN', 'SUPER_ADMIN'), (req, res, next) => {
    req.body.status = 'APPROVED';
    return kycController.verifyKYC(req, res, next);
});

router.patch('/:partnerId/reject', authorize('ADMIN', 'SUPER_ADMIN'), (req, res, next) => {
    req.body.status = 'REJECTED';
    return kycController.verifyKYC(req, res, next);
});

/**
 * @swagger
 * /kyc/eko/verify-pan:
 *   post:
 *     summary: Instant PAN verification via Eko API
 *     tags: [KYC & Onboarding]
 *     responses:
 *       200:
 *         description: PAN details verified
 */
router.post(
    '/eko/verify-pan',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    validate([
        body('panNumber').notEmpty().withMessage('PAN number is required'),
        body('fullName').notEmpty().withMessage('Full name is required'),
    ]),
    kycController.verifyEkoPan
);

/**
 * @swagger
 * /kyc/eko/verify-bank:
 *   post:
 *     summary: Instant Bank Account verification via Eko API
 *     tags: [KYC & Onboarding]
 *     responses:
 *       200:
 *         description: Bank account verified
 */
router.post(
    '/eko/verify-bank',
    authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER'),
    validate([
        body('accountNumber').notEmpty().withMessage('Account number is required'),
        body('ifscCode').notEmpty().withMessage('IFSC code is required'),
    ]),
    kycController.verifyEkoBank
);

export default router;
