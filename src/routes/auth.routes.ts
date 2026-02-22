import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    registerValidator,
    loginValidator,
    verifyEmailValidator,
    refreshTokenValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
    changePasswordValidator,
} from '../validators/auth.validator';

const router = Router();
const authController = new AuthController();

// Public routes
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new partner
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Partner registered successfully
 */
router.post('/register', validate(registerValidator), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate with email/phone and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: JWT token returned
 */
router.post('/login', validate(loginValidator), authController.login);
router.post('/verify-email', validate(verifyEmailValidator), authController.verifyEmail);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendVerificationOTP);
router.post('/forgot-password', validate(forgotPasswordValidator), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordValidator), authController.resetPassword);
router.post('/refresh-token', validate(refreshTokenValidator), authController.refreshToken);

// Protected routes
router.post('/logout', authenticateToken, authController.logout);
router.get('/profile', authenticateToken, authController.getProfile);
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current partner profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Partner profile data
 */
router.get('/me', authenticateToken, authController.getProfile); // Alias for profile

/**
 * @swagger
 * /auth/profile:
 *   patch:
 *     summary: Update profile info
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch('/profile', authenticateToken, authController.updateProfile);
router.post('/change-password', authenticateToken, validate(changePasswordValidator), authController.changePassword);

export default router;
