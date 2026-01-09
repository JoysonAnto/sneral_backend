import { Server as SocketIOServer } from 'socket.io';
import prisma from '../../config/database';
import logger from '../../utils/logger';

export const setupMessageHandlers = (io: SocketIOServer) => {
    const handleSendMessage = async (socket: any, data: { recipientId: string; message: string; bookingId?: string; tempId?: string }) => {
        try {
            // Create message in database
            const message = await prisma.message.create({
                data: {
                    sender_id: socket.userId,
                    receiver_id: data.recipientId,
                    content: data.message,
                    content_type: 'text',
                    ...(data.bookingId && { booking_id: data.bookingId }),
                },
                include: {
                    sender: {
                        select: {
                            full_name: true,
                            role: true,
                        },
                    },
                },
            });

            // Emit to recipient (check all namespaces)
            const messagePayload = {
                id: message.id,
                senderId: message.sender_id,
                senderName: message.sender.full_name,
                senderRole: message.sender.role,
                message: message.content,
                bookingId: data.bookingId,
                createdAt: message.created_at,
            };

            // Emit to recipient in appropriate namespace
            io.of('/customer').to(`user:${data.recipientId}`).emit('message:received', messagePayload);
            io.of('/partner').to(`user:${data.recipientId}`).emit('message:received', messagePayload);
            io.of('/admin').to(`user:${data.recipientId}`).emit('message:received', messagePayload);

            // Confirm to sender
            socket.emit('message:sent', {
                id: message.id,
                tempId: data.tempId, // Optional client-side temp ID
                createdAt: message.created_at,
            });

            logger.info(`Message sent from ${socket.userId} to ${data.recipientId}`);
        } catch (error) {
            logger.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    };

    // Setup for all namespaces
    ['/customer', '/partner', '/admin'].forEach((namespace) => {
        io.of(namespace).on('connection', (socket: any) => {
            socket.on('message:send', (data: any) => handleSendMessage(socket, data));

            // Mark messages as read
            socket.on('message:mark_read', async (messageId: string) => {
                try {
                    await prisma.message.update({
                        where: { id: messageId },
                        data: {
                            is_read: true,
                            read_at: new Date(),
                        },
                    });

                    socket.emit('message:read_confirmed', { messageId });
                } catch (error) {
                    logger.error('Error marking message as read:', error);
                }
            });

            // Typing indicator
            socket.on('typing:start', (recipientId: string) => {
                io.of('/customer').to(`user:${recipientId}`).emit('typing:indicator', {
                    userId: socket.userId,
                    typing: true,
                });
                io.of('/partner').to(`user:${recipientId}`).emit('typing:indicator', {
                    userId: socket.userId,
                    typing: true,
                });
            });

            socket.on('typing:stop', (recipientId: string) => {
                io.of('/customer').to(`user:${recipientId}`).emit('typing:indicator', {
                    userId: socket.userId,
                    typing: false,
                });
                io.of('/partner').to(`user:${recipientId}`).emit('typing:indicator', {
                    userId: socket.userId,
                    typing: false,
                });
            });
        });
    });
};

// Helper function to send system message
export const sendSystemMessage = async (io: SocketIOServer, userId: string, message: string, bookingId?: string) => {
    const systemMessage = {
        id: `system-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'SYSTEM',
        message,
        bookingId,
        createdAt: new Date(),
    };

    io.of('/customer').to(`user:${userId}`).emit('message:received', systemMessage);
    io.of('/partner').to(`user:${userId}`).emit('message:received', systemMessage);
};
