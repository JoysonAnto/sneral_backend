import { Server as SocketIOServer } from 'socket.io';
import logger from '../../utils/logger';

export const setupNotificationHandlers = (_io: SocketIOServer) => {
    // No specific listeners needed, just helpers for emitting
    logger.info('Notification handlers ready');
};

// Helper function to send notification to user
export const sendNotification = (
    io: SocketIOServer,
    userId: string,
    notification: {
        id: string;
        type: string;
        title: string;
        message: string;
        data?: any;
    }
) => {
    const payload = {
        ...notification,
        createdAt: new Date(),
        read: false,
    };

    // Send to all possible namespaces where user might be connected
    io.of('/customer').to(`user:${userId}`).emit('notification:new', payload);
    io.of('/partner').to(`user:${userId}`).emit('notification:new', payload);
    io.of('/admin').to(`user:${userId}`).emit('notification:new', payload);

    logger.info(`Notification sent to user ${userId}: ${notification.title}`);
};

// Helper function to send notification to multiple users
export const sendBulkNotification = (
    io: SocketIOServer,
    userIds: string[],
    notification: {
        type: string;
        title: string;
        message: string;
        data?: any;
    }
) => {
    userIds.forEach((userId) => {
        sendNotification(io, userId, {
            id: `${Date.now()}-${userId}`,
            ...notification,
        });
    });
};

// Helper function to send notification to all users in a role
export const sendRoleNotification = (
    io: SocketIOServer,
    role: string,
    notification: {
        type: string;
        title: string;
        message: string;
        data?: any;
    }
) => {
    const namespace = role === 'CUSTOMER' ? '/customer' : role.includes('PARTNER') ? '/partner' : '/admin';

    io.of(namespace).emit('notification:new', {
        id: `${Date.now()}`,
        ...notification,
        createdAt: new Date(),
        read: false,
    });

    logger.info(`Broadcast notification to ${role}: ${notification.title}`);
};
