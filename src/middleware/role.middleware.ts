import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

/**
 * Role-based authorization middleware
 * Usage: authorize('ADMIN', 'SUPER_ADMIN')
 */
export const authorize = (...allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Type assertion for authenticated user
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
            });
        }

        return next();
    };
};

export default authorize;
