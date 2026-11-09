import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt.helper';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                role: UserRole;
                email: string;
                permissions?: string[];
            };
        }
    }
}

export const authenticateToken = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw new UnauthorizedError('Access token required');
        }

        const decoded = verifyAccessToken(token) as any;
        req.user = decoded;
        next();
    } catch (error) {
        next(new UnauthorizedError('Invalid or expired token'));
    }
};

export const authorize = (...allowedRoles: UserRole[]) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            console.log(`❌ [AUTH DEBUG] Access denied for role: ${req.user?.role}, required: ${allowedRoles.join('|')}`);
            throw new ForbiddenError('Access denied - insufficient permissions');
        }
        next();
    };
};

export const checkPermission = (permission: string) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            throw new UnauthorizedError('Authentication required');
        }

        const userPermissions = req.user.permissions || [];

        // Super Admin has all permissions unrestricted
        if (req.user.role === UserRole.SUPER_ADMIN) {
            return next();
        }

        // If user has permissions list (from department role or explicit perms), enforce check
        if (userPermissions.includes(permission)) {
            return next();
        }

        // Legacy Admin without custom department restrictions
        if (req.user.role === UserRole.ADMIN && userPermissions.length === 0) {
            return next();
        }

        console.log(`❌ [AUTH DEBUG] Permission denied! Required: ${permission}, User role: ${req.user.role}, Perms: ${userPermissions.join(',')}`);
        throw new ForbiddenError(`Access denied - missing required permission: ${permission}`);
    };
};
