import prisma from '../config/database';
import { getIO } from '../socket/socket.server';
import { sendPushToToken } from './fcm.service';
import logger from '../utils/logger';

export class SupportChatService {
    /**
     * Resolves the primary Support Representative user (Super Admin or Admin)
     */
    async getSupportRepresentative(): Promise<{ id: string; name: string }> {
        const supportRep = await prisma.user.findFirst({
            where: {
                role: { in: ['SUPER_ADMIN', 'ADMIN'] },
                is_active: true,
            },
            select: { id: true, full_name: true },
            orderBy: { created_at: 'asc' },
        });

        if (supportRep) {
            return { id: supportRep.id, name: supportRep.full_name || 'Snearal Support' };
        }

        // Fallback: search any admin
        const anyAdmin = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' },
            select: { id: true, full_name: true },
        });

        return {
            id: anyAdmin?.id || 'admin_support_system',
            name: anyAdmin?.full_name || 'Snearal Support Desk',
        };
    }

    /**
     * Get or create a support thread for a Customer or Partner
     */
    async getThreadInfo(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, full_name: true, phone_number: true, email: true, role: true },
        });

        const supportRep = await this.getSupportRepresentative();

        const unreadCount = await prisma.message.count({
            where: {
                sender_id: supportRep.id,
                receiver_id: userId,
                is_read: false,
            },
        });

        return {
            user,
            support_agent: {
                id: supportRep.id,
                name: supportRep.name,
                title: 'Snearal 24/7 Live Desk',
                is_online: true,
            },
            unread_count: unreadCount,
        };
    }

    /**
     * Get message history between user and support
     */
    async getMessages(userId: string, targetUserId?: string) {
        const supportRep = await this.getSupportRepresentative();
        const clientUserId = targetUserId || userId;

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { sender_id: clientUserId, receiver_id: supportRep.id },
                    { sender_id: supportRep.id, receiver_id: clientUserId },
                    // Also support direct admin-to-user exchanges
                    { sender_id: clientUserId, receiver: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } },
                    { sender: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }, receiver_id: clientUserId },
                ],
            },
            include: {
                sender: { select: { id: true, full_name: true, role: true } },
            },
            orderBy: { created_at: 'asc' },
            take: 100,
        });

        // Mark incoming messages as read
        const readerId = targetUserId ? supportRep.id : clientUserId;
        await prisma.message.updateMany({
            where: {
                receiver_id: readerId,
                is_read: false,
            },
            data: {
                is_read: true,
                read_at: new Date(),
            },
        });

        return messages.map((m) => ({
            id: m.id,
            content: m.content,
            content_type: m.content_type,
            file_url: m.file_url,
            is_read: m.is_read,
            created_at: m.created_at,
            sender: {
                id: m.sender.id,
                name: m.sender.full_name,
                role: m.sender.role,
                is_support: m.sender.role === 'ADMIN' || m.sender.role === 'SUPER_ADMIN',
            },
        }));
    }

    /**
     * Send a support message (from Client to Support, or from Admin to Client)
     */
    async sendMessage(senderId: string, recipientId: string | null, content: string, contentType: string = 'text', fileUrl?: string) {
        const supportRep = await this.getSupportRepresentative();

        // Determine sender & receiver
        let finalReceiverId = recipientId;
        if (!finalReceiverId || finalReceiverId === 'support') {
            finalReceiverId = supportRep.id;
        }

        const sender = await prisma.user.findUnique({
            where: { id: senderId },
            select: { id: true, full_name: true, role: true, fcm_token: true },
        });

        const receiver = await prisma.user.findUnique({
            where: { id: finalReceiverId },
            select: { id: true, full_name: true, role: true, fcm_token: true },
        });

        const newMessage = await prisma.message.create({
            data: {
                sender_id: senderId,
                receiver_id: finalReceiverId,
                content: content.trim(),
                content_type: contentType,
                file_url: fileUrl,
            },
            include: {
                sender: { select: { id: true, full_name: true, role: true } },
            },
        });

        const formattedPayload = {
            id: newMessage.id,
            content: newMessage.content,
            content_type: newMessage.content_type,
            file_url: newMessage.file_url,
            created_at: newMessage.created_at,
            sender: {
                id: newMessage.sender.id,
                name: newMessage.sender.full_name,
                role: newMessage.sender.role,
                is_support: newMessage.sender.role === 'ADMIN' || newMessage.sender.role === 'SUPER_ADMIN',
            },
            clientId: newMessage.sender.role === 'CUSTOMER' || newMessage.sender.role === 'SERVICE_PARTNER' ? senderId : finalReceiverId,
        };

        // Real-time socket broadcast
        try {
            const io = getIO();
            const targetRoom = `user:${finalReceiverId}`;
            ['/customer', '/partner', '/admin'].forEach((ns) => {
                io.of(ns).to(targetRoom).emit('support:message_received', formattedPayload);
                io.of(ns).to(`user:${senderId}`).emit('support:message_sent', formattedPayload);
            });

            // Also broadcast thread update to all admin consoles
            io.of('/admin').emit('support:thread_updated', formattedPayload);
        } catch (sockErr) {
            logger.warn('[Support Chat] Socket broadcast skipped/failed:', sockErr);
        }

        // Push notification via FCM
        try {
            if (receiver?.fcm_token) {
                const isFromSupport = sender?.role === 'ADMIN' || sender?.role === 'SUPER_ADMIN';
                await sendPushToToken(receiver.fcm_token, {
                    title: isFromSupport ? '💬 Support Desk' : `💬 ${sender?.full_name || 'Support Request'}`,
                    body: content.length > 80 ? content.substring(0, 77) + '...' : content,
                    data: {
                        type: 'SUPPORT_CHAT',
                        senderId: senderId,
                        screen: 'SupportChat',
                    },
                    priority: 'high',
                });
            }
        } catch (pushErr) {
            logger.warn('[Support Chat] FCM push delivery failed:', pushErr);
        }

        return formattedPayload;
    }

    /**
     * Admin: Fetch all active support threads with user details & unread badge count
     */
    async getAllSupportThreads() {
        const supportRep = await this.getSupportRepresentative();

        // Get users who have messages with support
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { receiver_id: supportRep.id },
                    { sender_id: supportRep.id },
                    { receiver: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } },
                    { sender: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } },
                ],
            },
            include: {
                sender: { select: { id: true, full_name: true, phone_number: true, email: true, role: true } },
                receiver: { select: { id: true, full_name: true, phone_number: true, email: true, role: true } },
            },
            orderBy: { created_at: 'desc' },
            take: 300,
        });

        // Group by non-admin participant
        const threadsMap = new Map<string, any>();

        for (const msg of messages) {
            const isSenderClient = msg.sender.role === 'CUSTOMER' || msg.sender.role === 'SERVICE_PARTNER';
            const client = isSenderClient ? msg.sender : msg.receiver;

            if (!client || client.role === 'ADMIN' || client.role === 'SUPER_ADMIN') continue;

            if (!threadsMap.has(client.id)) {
                threadsMap.set(client.id, {
                    client_id: client.id,
                    name: client.full_name || 'Anonymous User',
                    phone: client.phone_number || 'N/A',
                    email: client.email || 'N/A',
                    role: client.role,
                    last_message: msg.content,
                    last_message_at: msg.created_at,
                    unread_count: 0,
                });
            }
        }

        // Calculate unread counts
        const threads = Array.from(threadsMap.values());
        for (const thread of threads) {
            const unread = await prisma.message.count({
                where: {
                    sender_id: thread.client_id,
                    receiver_id: supportRep.id,
                    is_read: false,
                },
            });
            thread.unread_count = unread;
        }

        // Sort by most recent message
        threads.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

        return threads;
    }
}

export const supportChatService = new SupportChatService();
