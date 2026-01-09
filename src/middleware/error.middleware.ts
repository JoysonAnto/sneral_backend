import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { Sentry } from '../config/sentry';
import fs from 'fs';
import path from 'path';

// Ensure error log directory exists
const errorLogDir = path.join(process.cwd(), 'logs', 'errors');
if (!fs.existsSync(errorLogDir)) {
    fs.mkdirSync(errorLogDir, { recursive: true });
}

/**
 * Global error handling middleware
 * Logs all errors to Winston and JSON files
 */
export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    try {
        // Create detailed error log
        const errorLog = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            body: process.env.NODE_ENV === 'production' ? '[REDACTED]' : req.body,
            params: req.params,
            query: req.query,
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack,
            },
        };

        // Log to Winston
        logger.error('API Error:', errorLog);

        // Send to Sentry
        if (process.env.SENTRY_DSN) {
            Sentry.withScope((scope) => {
                scope.setContext('request', {
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                });

                // Add user context if available
                if (req.user) {
                    scope.setUser({
                        id: req.user.userId,
                        email: req.user.email,
                    });
                }

                // Set severity level
                if (err instanceof AppError) {
                    scope.setLevel(err.statusCode >= 500 ? 'error' : 'warning');
                }

                Sentry.captureException(err);
            });
        }

        // Also log to separate error file for runtime tracking
        const errorFileName = `error-${new Date().toISOString().split('T')[0]}.json`;
        const errorFilePath = path.join(errorLogDir, errorFileName);

        try {
            let existingErrors: any[] = [];
            if (fs.existsSync(errorFilePath)) {
                const fileContent = fs.readFileSync(errorFilePath, 'utf-8');
                existingErrors = JSON.parse(fileContent);
            }
            existingErrors.push(errorLog);
            fs.writeFileSync(errorFilePath, JSON.stringify(existingErrors, null, 2));
        } catch (logError) {
            logger.error('Failed to write error log file:', logError);
        }

        // Handle AppError instances
        if (err instanceof AppError) {
            res.status(err.statusCode).json({
                success: false,
                error: {
                    code: err.code,
                    message: err.message,
                    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
                },
            });
            return;
        }

        // Handle generic errors
        const statusCode = 500;
        const message = process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message;

        res.status(statusCode).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message,
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
            },
        });
    } catch (handlerError) {
        // Fallback error handling
        logger.error('Error in error handler:', handlerError);
        res.status(500).json({
            success: false,
            error: {
                code: 'CRITICAL_ERROR',
                message: 'An unexpected error occurred',
            },
        });
    }
};
