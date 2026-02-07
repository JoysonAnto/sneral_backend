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
router.post('/register', validate(registerValidator), authController.register);
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
router.get('/me', authenticateToken, authController.getProfile); // Alias for profile
router.patch('/profile', authenticateToken, authController.updateProfile);
router.post('/change-password', authenticateToken, validate(changePasswordValidator), authController.changePassword);

export default router;
