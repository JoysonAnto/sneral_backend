
import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';
import { successResponse } from '../utils/response';
import prisma from '../config/database';

export class MessageController {
    private messageService: MessageService;

    constructor() {
        this.messageService = new MessageService();
    }

    getConversations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const conversations = await this.messageService.getConversations(req.user!.userId);
            return res.json(successResponse(conversations, 'Conversations retrieved successfully'));
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
            return res.json(
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

    // [GET] /api/v1/messages/conversations/:id
    // New Spec: id is likely the bookingId (context of conversation)
    getConversationHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const messages = await this.messageService.getConversationHistory(req.params.id);
            return res.json(successResponse(messages, 'History retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // [POST] /api/v1/messages/conversations/:id/messages
    // Payload: { text: string, bookingId: string }
    sendSpecMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { text, bookingId } = req.body;
            
            // Find receiver (the other party in the booking)
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId || req.params.id },
                select: { customer_id: true, partner_id: true }
            });

            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }

            // If current user is customer, receiver is partner, and vice versa
            const receiverId = req.user!.role === 'CUSTOMER' ? booking.partner_id : booking.customer_id;

            if (!receiverId) {
                return res.status(400).json({ message: 'No participant to receive the message' });
            }

            const message = await this.messageService.sendMessage(
                req.user!.userId,
                receiverId,
                text,
                bookingId || req.params.id
            );
            return res.status(201).json(successResponse(message, 'Message sent successfully'));
        } catch (error) {
            next(error);
        }
    };

    sendMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const message = await this.messageService.sendMessage(
                req.user!.userId,
                req.params.id, // recipientId in this old method
                req.body.message,
                req.body.bookingId
            );
            return res.status(201).json(successResponse(message, 'Message sent successfully'));
        } catch (error) {
            next(error);
        }
    };

    // [POST] /api/v1/messages/upload
    uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { bookingId, recipientId, type } = req.body;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            // Cloudinary URL should be in req.file.path if using cloudinary storage with multer
            const fileUrl = (file as any).path || (file as any).secure_url || `/uploads/chat/${file.filename}`;

            const message = await this.messageService.sendMessage(
                req.user!.userId,
                recipientId,
                `Sent a ${type || 'file'}`,
                bookingId,
                type || 'image',
                fileUrl
            );

            return res.status(201).json(successResponse(message, 'Attachment uploaded and sent'));
        } catch (error) {
            next(error);
        }
    };
}
