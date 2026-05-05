import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { successResponse } from '../utils/response';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    register = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password, fullName, phoneNumber, role, categoryId, businessName, businessType } = req.body;
            const result = await this.authService.register({
                email,
                password,
                fullName,
                phoneNumber,
                role,
                categoryId,
                businessName,
                businessType,
            });
            return res.status(201).json(successResponse(result, result.message));
        } catch (error) {
            return next(error);
        }
    };

    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password, phoneNumber } = req.body;
            const identifier = email || phoneNumber;
            if (!identifier) {
                return res.status(400).json({ status: 'error', message: 'Email or phone number is required' });
            }
            const result = await this.authService.login(identifier, password);
            return res.json(successResponse(result, result.message || 'Login successful'));
        } catch (error) {
            return next(error);
        }
    };

    verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, phoneNumber, otp } = req.body;
            const identifier = email || phoneNumber;
            const result = await this.authService.verifyOtp(identifier, otp);
            return res.json(successResponse(result, result.message));
        } catch (error) {
            return next(error);
        }
    };

    verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, phoneNumber, otp } = req.body;
            const identifier = email || phoneNumber;
            const result = await this.authService.verifyOtp(identifier, otp);
            return res.json(successResponse(result, result.message));
        } catch (error) {
            return next(error);
        }
    };

    resendVerificationOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = req.body;
            const result = await this.authService.resendVerificationOTP(email);
            return res.json(successResponse(null, result.message));
        } catch (error) {
            return next(error);
        }
    };

    forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = req.body;
            const result = await this.authService.forgotPassword(email);
            return res.json(successResponse(null, result.message));
        } catch (error) {
            return next(error);
        }
    };

    resetPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, otp, newPassword } = req.body;
            const result = await this.authService.resetPassword(email, otp, newPassword);
            return res.json(successResponse(null, result.message));
        } catch (error) {
            return next(error);
        }
    };

    refreshToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { refreshToken } = req.body;
            const result = await this.authService.refreshToken(refreshToken);
            return res.json(successResponse(result, 'Token refreshed successfully'));
        } catch (error) {
            return next(error);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.authService.logout(req.user!.userId);
            return res.json(successResponse(null, result.message));
        } catch (error) {
            return next(error);
        }
    };

    getProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const profile = await this.authService.getProfile(req.user!.userId);
            return res.json(successResponse(profile, 'Profile retrieved successfully'));
        } catch (error) {
            return next(error);
        }
    };

    updateProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const profile = await this.authService.updateProfile(req.user!.userId, req.body);
            return res.json(successResponse(profile, 'Profile updated successfully'));
        } catch (error) {
            return next(error);
        }
    };

    changePassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { oldPassword, newPassword } = req.body;
            const result = await this.authService.changePassword(
                req.user!.userId,
                oldPassword,
                newPassword
            );
            return res.json(successResponse(null, result.message));
        } catch (error) {
            return next(error);
        }
    };
}
