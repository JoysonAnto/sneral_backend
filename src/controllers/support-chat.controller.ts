import { Request, Response, NextFunction } from 'express';
import { supportChatService } from '../services/support-chat.service';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../utils/errors';

export class SupportChatController {
    /**
     * GET /api/v1/support/chat/thread
     * Customer/Partner retrieves their support desk thread status and support agent profile
     */
    getThreadInfo = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await supportChatService.getThreadInfo(req.user!.userId);
            res.json(successResponse(result, 'Support thread retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/support/chat/messages
     * Customer/Partner retrieves their support chat history
     */
    getMessages = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const targetUserId = req.query.userId as string | undefined;
            // Only admin can specify a targetUserId
            const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
            const clientId = isAdmin && targetUserId ? targetUserId : req.user!.userId;

            const messages = await supportChatService.getMessages(req.user!.userId, clientId);
            res.json(successResponse(messages, 'Messages retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/support/chat/messages
     * Send message to Support (Client -> Admin) or to Client (Admin -> Client)
     */
    sendMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { message, recipientId, contentType, fileUrl } = req.body;
            if (!message || !message.trim()) {
                throw new BadRequestError('Message content cannot be empty');
            }

            const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
            let targetRecipientId = recipientId;

            if (!isAdmin) {
                targetRecipientId = null; // Client always routes to default support rep
            } else if (!targetRecipientId) {
                throw new BadRequestError('Recipient ID is required for administrative replies');
            }

            const result = await supportChatService.sendMessage(
                req.user!.userId,
                targetRecipientId,
                message,
                contentType || 'text',
                fileUrl
            );

            res.status(201).json(successResponse(result, 'Message sent successfully'));
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/support/chat/admin/threads
     * Admin: Retrieve all customer and partner support inquiries with unread counts
     */
    getAdminThreads = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const threads = await supportChatService.getAllSupportThreads();
            res.json(successResponse(threads, 'Support threads retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };
}

export const supportChatController = new SupportChatController();
