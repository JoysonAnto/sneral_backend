import { Router } from 'express';
import { CashfreeController } from '../controllers/cashfree.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const cashfreeController = new CashfreeController();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC WEBHOOK — Cashfree calls this when KYC is complete (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /kyc/cashfree/webhook:
 *   post:
 *     summary: Cashfree KYC webhook — automatically approves/rejects partner KYC
 *     tags: [KYC Cashfree]
 *     description: |
 *       This endpoint is called by Cashfree when a KYC link is completed, rejected or expired.
 *       It automatically updates the partner's kyc_status in the database and sends an in-app notification.
 *       **Do not call this manually — configure this URL in your Cashfree Dashboard under Webhook Settings.**
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verification_id:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, COMPLETED, REJECTED, EXPIRED, DEACTIVATED, ACTION_REQUIRED]
 */
router.post('/webhook', cashfreeController.handleWebhook);

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED PARTNER ROUTES
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticateToken);

/**
 * @swagger
 * /kyc/cashfree/initiate:
 *   post:
 *     summary: Initiate Cashfree KYC for the logged-in service partner
 *     tags: [KYC Cashfree]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Generates a Cashfree KYC verification link for the authenticated service partner.
 *       The returned `kyc_link` should be opened in a browser/webview so the partner can
 *       complete Aadhaar + PAN + Liveness verification on the Cashfree-hosted form.
 *       Once completed, the partner's status is updated automatically via the webhook.
 *     responses:
 *       200:
 *         description: KYC link generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 kyc_link:
 *                   type: string
 *                   example: "https://kyc.cashfree.com/link/abc123"
 *                 verification_id:
 *                   type: string
 *                 expires_at:
 *                   type: string
 */
router.post(
    '/initiate',
    authorize('SERVICE_PARTNER'),
    cashfreeController.initiateKYC
);

/**
 * @swagger
 * /kyc/cashfree/status/me:
 *   get:
 *     summary: Check the KYC status of the logged-in service partner
 *     tags: [KYC Cashfree]
 *     security:
 *       - bearerAuth: []
 */
router.get(
    '/status/me',
    authorize('SERVICE_PARTNER'),
    cashfreeController.getMyKYCStatus
);

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL VERIFICATION APIs (Both partner types)
// ─────────────────────────────────────────────────────────────────────────────
router.use(authorize('SERVICE_PARTNER', 'BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'));

/**
 * @swagger
 * /kyc/cashfree/verify-pan:
 *   post:
 *     summary: Instantly verify a PAN card via Cashfree
 *     tags: [KYC Cashfree]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pan]
 *             properties:
 *               pan:
 *                 type: string
 *                 example: ABCDE1234F
 *               name:
 *                 type: string
 *                 description: Name to match against PAN records
 */
router.post(
    '/verify-pan',
    validate([
        body('pan')
            .notEmpty().withMessage('PAN is required')
            .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN format (e.g. ABCDE1234F)'),
    ]),
    cashfreeController.verifyPAN
);

/**
 * @swagger
 * /kyc/cashfree/aadhaar/generate-otp:
 *   post:
 *     summary: Step 1 — Generate Aadhaar OTP for verification
 *     tags: [KYC Cashfree]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/aadhaar/generate-otp',
    validate([
        body('aadhaar_number')
            .notEmpty().withMessage('Aadhaar number is required')
            .matches(/^\d{12}$/).withMessage('Aadhaar must be a 12-digit number'),
    ]),
    cashfreeController.aadhaarGenerateOTP
);

/**
 * @swagger
 * /kyc/cashfree/aadhaar/verify-otp:
 *   post:
 *     summary: Step 2 — Verify Aadhaar OTP and retrieve Aadhaar details
 *     tags: [KYC Cashfree]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/aadhaar/verify-otp',
    validate([
        body('ref_id').notEmpty().withMessage('ref_id from step 1 is required'),
        body('otp').notEmpty().withMessage('OTP is required'),
    ]),
    cashfreeController.aadhaarVerifyOTP
);

/**
 * @swagger
 * /kyc/cashfree/verify-bank:
 *   post:
 *     summary: Verify a bank account number and IFSC via Cashfree Penny Drop
 *     tags: [KYC Cashfree]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [account_number, ifsc]
 *             properties:
 *               account_number:
 *                 type: string
 *               ifsc:
 *                 type: string
 *               name:
 *                 type: string
 */
router.post(
    '/verify-bank',
    validate([
        body('account_number').notEmpty().withMessage('account_number is required'),
        body('ifsc')
            .notEmpty().withMessage('IFSC code is required')
            .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC format'),
    ]),
    cashfreeController.verifyBankAccount
);

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY / ADMIN - Manual KYC link generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /kyc/cashfree/generate-link:
 *   post:
 *     summary: Manually generate a Cashfree KYC link for any phone number (Admin/legacy)
 *     tags: [KYC Cashfree]
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
 *     summary: Check the status of a KYC link by verification ID
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

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT GATEWAY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/orders', cashfreeController.createOrder);
router.get('/orders/:orderId', cashfreeController.getOrderStatus);

export default router;
