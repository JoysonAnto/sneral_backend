import { Request, Response, NextFunction } from 'express';
import { SsoService } from '../services/sso.service';
import { successResponse } from '../utils/response';
import logger from '../utils/logger';

export class SsoController {
    private ssoService: SsoService;

    constructor() {
        this.ssoService = new SsoService();
    }

    googleLogin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { idToken, token, role, email, fullName } = req.body;
            const targetToken = idToken || token;

            if (!targetToken && !email) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Google authentication token (idToken) or verified email is required'
                });
            }

            logger.info(`🔑 [SSO] Google authentication attempt for ${email || 'token'}`);
            const result = await this.ssoService.googleLogin(targetToken, role || 'CUSTOMER', email, fullName);

            return res.json(successResponse(result, 'Google SSO login successful'));
        } catch (error) {
            return next(error);
        }
    };

    appleLogin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { identityToken, token, role, email, fullName } = req.body;
            const targetToken = identityToken || token;

            if (!targetToken && !email) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Apple identity token or email is required'
                });
            }

            logger.info(`🍎 [SSO] Apple authentication attempt for ${email || 'token'}`);
            const result = await this.ssoService.appleLogin(targetToken, role || 'CUSTOMER', email, fullName);

            return res.json(successResponse(result, 'Apple SSO login successful'));
        } catch (error) {
            return next(error);
        }
    };
}
