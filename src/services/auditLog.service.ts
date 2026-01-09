import prisma from '../config/database';
import { logger } from '../utils/logger';

interface AuditLogData {
    user_id?: string;
    action: string;
    resource_type?: string;
    resource_id?: string;
    details?: any;
    ip_address?: string;
    user_agent?: string;
    status?: 'SUCCESS' | 'FAILURE';
}

/**
 * Enhanced Audit Logging Service
 * Tracks all sensitive operations for compliance and security
 */
export class AuditLogService {
    /**
     * Log user action
     */
    static async log(data: AuditLogData): Promise<void> {
        try {
            await prisma.auditLog.create({
                data: {
                    user_id: data.user_id,
                    action: data.action,
                    resource_type: data.resource_type,
                    resource_id: data.resource_id,
                    details: data.details || {},
                    ip_address: data.ip_address,
                    user_agent: data.user_agent,
                    status: data.status || 'SUCCESS',
                    timestamp: new Date(),
                },
            });
        } catch (error) {
            logger.error('Failed to create audit log:', error);
            // Don't throw - audit logging failure shouldn't break the app
        }
    }

    /**
     * Log authentication events
     */
    static async logAuth(
        action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'TOKEN_REFRESH',
        userId?: string,
        ip?: string,
        userAgent?: string,
        details?: any
    ): Promise<void> {
        await this.log({
            user_id: userId,
            action,
            resource_type: 'AUTH',
            details,
            ip_address: ip,
            user_agent: userAgent,
            status: action.includes('FAILED') ? 'FAILURE' : 'SUCCESS',
        });
    }

    /**
     * Log payment operations
     */
    static async logPayment(
        action: 'PAYMENT_CREATED' | 'PAYMENT_COMPLETED' | 'PAYMENT_FAILED' | 'REFUND_PROCESSED',
        userId: string,
        paymentId: string,
        amount: number,
        ip?: string,
        details?: any
    ): Promise<void> {
        await this.log({
            user_id: userId,
            action,
            resource_type: 'PAYMENT',
            resource_id: paymentId,
            details: { amount, ...details },
            ip_address: ip,
        });
    }

    /**
     * Log data access (GDPR compliance)
     */
    static async logDataAccess(
        action: 'DATA_EXPORTED' | 'DATA_DELETED' | 'DATA_UPDATED',
        userId: string,
        resourceType: string,
        ip?: string,
        details?: any
    ): Promise<void> {
        await this.log({
            user_id: userId,
            action,
            resource_type: resourceType,
            details,
            ip_address: ip,
        });
    }

    /**
     * Log admin actions
     */
    static async logAdminAction(
        action: string,
        adminId: string,
        targetResourceType: string,
        targetResourceId: string,
        ip?: string,
        details?: any
    ): Promise<void> {
        await this.log({
            user_id: adminId,
            action: `ADMIN_${action}`,
            resource_type: targetResourceType,
            resource_id: targetResourceId,
            details,
            ip_address: ip,
        });
    }

    /**
     * Log security events
     */
    static async logSecurityEvent(
        action: 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS',
        userId?: string,
        ip?: string,
        details?: any
    ): Promise<void> {
        await this.log({
            user_id: userId,
            action,
            resource_type: 'SECURITY',
            details,
            ip_address: ip,
            status: 'FAILURE',
        });

        // Also log to Winston for immediate alerting
        logger.warn(`Security Event: ${action}`, { userId, ip, details });
    }

    /**
     * Get audit logs for a user (GDPR compliance)
     */
    static async getUserAuditLogs(userId: string, limit: number = 100) {
        return await prisma.auditLog.findMany({
            where: { user_id: userId },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    /**
     * Get audit logs by action type
     */
    static async getLogsByAction(action: string, limit: number = 100) {
        return await prisma.auditLog.findMany({
            where: { action },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
}
