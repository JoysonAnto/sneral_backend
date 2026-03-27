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

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User login, registration, and session management
 */

// Public routes
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new partner or user
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
 *               - fullName
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *         description: JWT token and refresh token returned
 */
router.post('/login', validate(loginValidator), authController.login);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email address with token
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.post('/verify-email', validate(verifyEmailValidator), authController.verifyEmail);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP for phone/email validation
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 */
router.post('/verify-otp', authController.verifyOtp);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend verification OTP
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: OTP resent
 */
router.post('/resend-otp', authController.resendVerificationOTP);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset link/OTP
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Reset instructions sent
 */
router.post('/forgot-password', validate(forgotPasswordValidator), authController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using token/OTP
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post('/reset-password', validate(resetPasswordValidator), authController.resetPassword);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Exchange refresh token for new access token
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: New access token issued
 */
router.post('/refresh-token', validate(refreshTokenValidator), authController.refreshToken);

// Protected routes
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Terminate session and invalidate tokens
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get profile of authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 */
router.get('/profile', authenticateToken, authController.getProfile);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Alias for profile endpoint
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
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
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch('/profile', authenticateToken, authController.updateProfile);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Update password (requires current password)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password updated
 */
router.post('/change-password', authenticateToken, validate(changePasswordValidator), authController.changePassword);

export default router;
