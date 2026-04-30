
import prisma from '../config/database';
import { getIO } from '../socket/socket.server';
import logger from '../utils/logger';

const namespaces = ['/customer', '/partner', '/admin'];

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
            messages: await Promise.all(messages.map(m => this.formatMessage(m))),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
            },
        };
    }

    async formatMessage(message: any) {
        const sender = await prisma.user.findUnique({
            where: { id: message.sender_id },
            include: { profile: true }
        });

        return {
            id: message.id,
            conversationId: message.booking_id || 'general',
            text: message.content,
            contentType: message.content_type,
            fileUrl: message.file_url,
            createdAt: message.created_at,
            sender: {
                id: sender?.id,
                name: sender?.full_name || 'Unknown',
                role: sender?.role,
                avatarUrl: sender?.profile?.avatar_url
            }
        };
    }

    async sendMessage(senderId: string, recipientId: string, message: string, bookingId?: string, contentType: string = 'text', fileUrl?: string) {
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
                content_type: contentType,
                file_url: fileUrl,
                ...(bookingId && { booking_id: bookingId }),
            },
        });

        const formattedMessage = await this.formatMessage(newMessage);

        // Emit Socket.IO event
        try {
            const io = getIO();
            const roomName = `booking_${bookingId || 'general'}`;

            // 🎯 DIRECT DELIVERY STRATEGY
            // To prevent self-delivery (echo), we target the specific recipient's room
            // and specialized monitor rooms (Admins), rather than the general booking room.
            namespaces.forEach(ns => {
                const targetNamespace = io.of(ns);
                // 1. Deliver directly to the recipient's personal room
                // This is the most reliable way to avoid the sender receiving their own message.
                targetNamespace.to(recipientId).emit('chat:message', formattedMessage);

                // 2. Deliver to specialized monitor rooms (Admins/Support)
                // This ensures non-participants who need to monitor the chat can see it 
                // without triggering an echo for the sender.
                // targetNamespace.to('admin:monitor').to('admin').emit('chat:message', formattedMessage);
            });
        } catch (error) {
            console.error('Socket emission failed in MessageService:', error);
        }

        return formattedMessage;
    }

    async getConversationHistory(bookingId: string) {
        const messages = await prisma.message.findMany({
            where: { booking_id: bookingId },
            orderBy: { created_at: 'desc' },
            take: 100
        });

        const formattedMessages = await Promise.all(messages.map(m => this.formatMessage(m)));
        return formattedMessages.reverse();
    }
}
