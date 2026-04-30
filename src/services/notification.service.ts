import prisma from '../config/database';
import { getIO } from '../socket/socket.server';
import logger from '../utils/logger';
import { sendPushToToken } from './fcm.service';

export class NotificationService {
    async getNotifications(userId: string, filters: any) {
        const { page = 1, limit = 20, unreadOnly = 'false' } = filters;

        const skip = (page - 1) * limit;

        let where: any = { user_id: userId };

        if (unreadOnly === 'true') {
            where.is_read = false;
        }

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { created_at: 'desc' },
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({
                where: { user_id: userId, is_read: false },
            }),
        ]);

        return {
            notifications: notifications.map(n => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                data: n.data,
                isRead: n.is_read,
                createdAt: n.created_at,
                time: n.created_at.toISOString() // Client can format this
            })),
            unreadCount,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
            },
        };
    }

    async markAsRead(notificationId: string, userId: string) {
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification || notification.user_id !== userId) {
            throw new Error('Notification not found');
        }

        await prisma.notification.update({
            where: { id: notificationId },
            data: {
                is_read: true,
                read_at: new Date(),
            },
        });

        return { message: 'Notification marked as read' };
    }

    async markAllAsRead(userId: string) {
        await prisma.notification.updateMany({
            where: {
                user_id: userId,
                is_read: false,
            },
            data: {
                is_read: true,
                read_at: new Date(),
            },
        });

        return { message: 'All notifications marked as read' };
    }

    async deleteNotification(notificationId: string, userId: string) {
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification || notification.user_id !== userId) {
            throw new Error('Notification not found');
        }

        await prisma.notification.delete({
            where: { id: notificationId },
        });

        return { message: 'Notification deleted successfully' };
    }

    // Internal method to create notification
    async createNotification(
        userId: string,
        type: string,
        title: string,
        message: string,
        data?: any
    ) {
        const notification = await prisma.notification.create({
            data: {
                user_id: userId,
                type: type as any,
                title,
                message,
                data,
            },
        });

        // Emit Socket.IO event to all namespaces (customer, partner, admin)
        // Note: The user might be connected to any namespace
        try {
            const io = getIO();
            const notificationData = {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                read: notification.is_read,
                createdAt: notification.created_at,
            };

            // Emit to all namespaces - users join rooms named after their user_id
            io.of('/customer').to(userId).emit('notification:new', notificationData);
            io.of('/partner').to(userId).emit('notification:new', notificationData);
            io.of('/admin').to(userId).emit('notification:new', notificationData);

            logger.info(`Real-time notification sent to user ${userId}`);
        } catch (error) {
            // Socket might not be initialized yet or user not connected
            logger.warn(`Could not send real-time notification to user ${userId}: ${error}`);
        }

        // Send FCM push notification if user has a registered device token
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { fcm_token: true },
            });

            if (user?.fcm_token) {
                const pushed = await sendPushToToken(user.fcm_token, {
                    title,
                    body: message,
                    data: {
                        type,
                        notificationId: notification.id,
                        ...(data ? Object.fromEntries(
                            Object.entries(data).map(([k, v]) => [k, String(v)])
                        ) : {}),
                    },
                });
                if (pushed) {
                    logger.info(`[FCM] Push sent to user ${userId} for type=${type}`);
                }
            }
        } catch (fcmError) {
            logger.warn(`[FCM] Could not send push to user ${userId}: ${fcmError}`);
        }

        return notification;
    }

    /**
     * Called by the mobile app after login to register / refresh the FCM device token.
     * A user can have only one active token at a time (last-device wins).
     */
    async updateFcmToken(userId: string, fcmToken: string) {
        await prisma.user.update({
            where: { id: userId },
            data: { fcm_token: fcmToken },
        });
        logger.info(`[FCM] Token registered for user ${userId}`);
        return { message: 'Device token registered successfully' };
    }

    /**
     * Remove the FCM token (e.g., on logout).
     */
    async removeFcmToken(userId: string) {
        await prisma.user.update({
            where: { id: userId },
            data: { fcm_token: null },
        });
        logger.info(`[FCM] Token removed for user ${userId}`);
        return { message: 'Device token removed' };
    }
}
