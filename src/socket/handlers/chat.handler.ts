
import { Server as SocketIOServer } from 'socket.io';
import prisma from '../../config/database';
import logger from '../../utils/logger';

export const setupChatHandlers = (io: SocketIOServer) => {
    const namespaces = ['/customer', '/partner', '/admin'];

    namespaces.forEach((namespace) => {
        const nsp = io.of(namespace);

        nsp.on('connection', (socket: any) => {
            const userId = socket.userId;

            // 🟢 chat:join - Join a conversation room (SPEC: booking_${conversationId})
            socket.on('chat:join', (data: { conversationId: string }) => {
                const roomName = `booking_${data.conversationId}`;
                socket.join(roomName);
                logger.info(`User ${userId} joined room ${roomName}`);
            });

            // 🔴 chat:leave - Leave a conversation room
            socket.on('chat:leave', (data: { conversationId: string }) => {
                const roomName = `booking_${data.conversationId}`;
                socket.leave(roomName);
                logger.info(`User ${userId} left room ${roomName}`);
            });

            // ⌨️ chat:typing - Typing indicators
            socket.on('chat:typing', async (data: { conversationId: string; isTyping: boolean }) => {
                const roomName = `booking_${data.conversationId}`;
                socket.to(roomName).emit('chat:typing', {
                    conversationId: data.conversationId,
                    isTyping: data.isTyping,
                    userId: userId
                });
            });

            // 📞 call:initiate - Start a call
            socket.on('call:initiate', async (data: { recipientId: string; conversationId: string; type: 'audio' | 'video' }) => {
                const targetRoom = `user:${data.recipientId}`;
                
                // Fetch caller name for call:incoming
                const caller = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { full_name: true }
                });

                // Relay to the recipient's personal room across all namespaces
                namespaces.forEach(ns => {
                    io.of(ns).to(targetRoom).emit('call:incoming', {
                        callerId: userId,
                        callerName: caller?.full_name || 'Anonymous', // SPEC: include callerName
                        conversationId: data.conversationId,
                        type: data.type
                    });
                });
                logger.info(`Call initiated from ${userId} (${caller?.full_name}) to ${data.recipientId}`);
            });

            // 📞 call:respond - Accept/Reject/Busy
            socket.on('call:respond', (data: { callerId: string; conversationId: string; response: 'accept' | 'reject' | 'busy' | 'no-answer' }) => {
                const targetRoom = `user:${data.callerId}`;
                namespaces.forEach(ns => {
                    io.of(ns).to(targetRoom).emit('call:response', {
                        responderId: userId,
                        conversationId: data.conversationId,
                        response: data.response
                    });
                });
            });

            // 📞 call:signal - WebRTC Signalling (SDP/ICE)
            socket.on('call:signal', (data: { targetId: string; conversationId: string; signal: any }) => {
                const targetRoom = `user:${data.targetId}`;
                namespaces.forEach(ns => {
                    io.of(ns).to(targetRoom).emit('call:signal', {
                        senderId: userId,
                        conversationId: data.conversationId,
                        signal: data.signal
                    });
                });
            });

            // 📞 call:ended - Hang up
            socket.on('call:ended', (data: { targetId: string; conversationId: string }) => {
                const targetRoom = `user:${data.targetId}`;
                namespaces.forEach(ns => {
                    io.of(ns).to(targetRoom).emit('call:ended', {
                        conversationId: data.conversationId
                    });
                });
            });
        });
    });
};
