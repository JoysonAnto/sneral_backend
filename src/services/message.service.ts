import prisma from '../config/database';
import { getIO } from '../socket/socket.server';
import logger from '../utils/logger';

export class MessageService {
    async getConversations(userId: string) {
        // Get all conversations where user is either sender or receiver
        const messages = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT ON (conversation_id)
        CASE 
          WHEN sender_id = ${userId} THEN receiver_id
          ELSE sender_id
        END as participant_id,
        content as last_message,
        created_at as last_message_at,
        is_read
      FROM (
        SELECT 
          CASE 
            WHEN sender_id < receiver_id 
            THEN CONCAT(sender_id, '_', receiver_id)
            ELSE CONCAT(receiver_id, '_', sender_id)
          END as conversation_id,
          sender_id,
          receiver_id,
          content,
          created_at,
          is_read
        FROM messages
        WHERE sender_id = ${userId} OR receiver_id = ${userId}
        ORDER BY created_at DESC
      ) sub
      ORDER BY conversation_id, last_message_at DESC
    `;

        // Get participant details and unread counts
        const conversations = await Promise.all(
            messages.map(async (msg) => {
                const participant = await prisma.user.findUnique({
                    where: { id: msg.participant_id },
                    select: {
                        id: true,
                        full_name: true,
                        role: true,
                    },
                });

                const unreadCount = await prisma.message.count({
                    where: {
                        sender_id: msg.participant_id,
                        receiver_id: userId,
                        is_read: false,
                    },
                });

                return {
                    id: msg.participant_id,
                    participantId: msg.participant_id,
                    participantName: participant?.full_name || 'Unknown',
                    participantRole: participant?.role || 'CUSTOMER',
                    lastMessage: msg.last_message,
                    unreadCount,
                    updatedAt: msg.last_message_at,
                };
            })
        );

        return conversations;
    }

    async getConversationMessages(userId: string, participantId: string, filters: any) {
        const { page = 1, limit = 50 } = filters;
        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: {
                    OR: [
                        { sender_id: userId, receiver_id: participantId },
                        { sender_id: participantId, receiver_id: userId },
                    ],
                },
                skip,
                take: Number(limit),
                orderBy: { created_at: 'asc' },
            }),
            prisma.message.count({
                where: {
                    OR: [
                        { sender_id: userId, receiver_id: participantId },
                        { sender_id: participantId, receiver_id: userId },
                    ],
                },
            }),
        ]);

        // Mark messages as read
        await prisma.message.updateMany({
            where: {
                sender_id: participantId,
                receiver_id: userId,
                is_read: false,
            },
            data: {
                is_read: true,
                read_at: new Date(),
            },
        });

        return {
            messages: messages.map(m => ({
                id: m.id,
                senderId: m.sender_id,
                message: m.content,
                createdAt: m.created_at,
                read: m.is_read,
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
            },
        };
    }

    async sendMessage(senderId: string, recipientId: string, message: string, bookingId?: string) {
        // Verify recipient exists
        const recipient = await prisma.user.findUnique({
            where: { id: recipientId },
        });

        if (!recipient) {
            throw new Error('Recipient not found');
        }

        const newMessage = await prisma.message.create({
            data: {
                sender_id: senderId,
                receiver_id: recipientId,
                content: message,
                content_type: 'text',
                ...(bookingId && { booking_id: bookingId }),
            },
        });

        // Emit Socket.IO event
        try {
            const io = getIO();
            const messageData = {
                id: newMessage.id,
                senderId: newMessage.sender_id,
                receiverId: newMessage.receiver_id,
                content: newMessage.content,
                createdAt: newMessage.created_at,
                bookingId: newMessage.booking_id,
            };

            // Notify recipient in their private room
            io.of('/customer').to(recipientId).emit('message:new', messageData);
            io.of('/partner').to(recipientId).emit('message:new', messageData);

            // Also emit to the sender's other sessions
            io.of('/customer').to(senderId).emit('message:sent', messageData);
            io.of('/partner').to(senderId).emit('message:sent', messageData);
        } catch (error) {
            logger.warn('Failed to emit real-time message event:', error);
        }

        // TODO: Send push notification to recipient

        return {
            id: newMessage.id,
            senderId: newMessage.sender_id,
            receiverId: newMessage.receiver_id,
            message: newMessage.content,
            createdAt: newMessage.created_at,
        };
    }
}
