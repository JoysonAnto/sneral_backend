import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';
import { successResponse } from '../utils/response';

export class MessageController {
    private messageService: MessageService;

    constructor() {
        this.messageService = new MessageService();
    }

    getConversations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const conversations = await this.messageService.getConversations(req.user!.userId);
            res.json(successResponse(conversations, 'Conversations retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getConversationMessages = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.messageService.getConversationMessages(
                req.user!.userId,
                req.params.id,
                req.query
            );
            res.json(
                successResponse(
                    result.messages,
                    'Messages retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    sendMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const message = await this.messageService.sendMessage(
                req.user!.userId,
                req.params.id,
                req.body.message,
                req.body.bookingId
            );
            res.status(201).json(successResponse(message, 'Message sent successfully'));
        } catch (error) {
            next(error);
        }
    };
}
