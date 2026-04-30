
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
            return next(error);
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
            return next(error);
        }
    };

    // [GET] /api/v1/messages/conversations/:id
    // New Spec: id is likely the bookingId (context of conversation)
    getConversationHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const bookingId = req.params.id;
            const userId = req.user!.userId;
            const userRole = req.user!.role;

            // Verify access to this booking
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { partner: true }
            });

            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }

            const isCustomer = booking.customer_id === userId;
            const isPartner = booking.partner?.user_id === userId;
            const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

            // Business Partner check
            let isBusinessPartner = false;
            if (userRole === 'BUSINESS_PARTNER') {
                const bp = await prisma.businessPartner.findUnique({
                    where: { user_id: userId }
                });
                isBusinessPartner = bp?.id === booking.business_partner_id;
            }

            if (!isCustomer && !isPartner && !isAdmin && !isBusinessPartner) {
                return res.status(403).json({ message: 'You do not have permission to view this conversation' });
            }

            const messages = await this.messageService.getConversationHistory(bookingId);
            return res.json(successResponse(messages, 'History retrieved successfully'));
        } catch (error) {
            return next(error);
        }
    };

    // [POST] /api/v1/messages/conversations/:id/messages
    // Payload: { text: string, bookingId: string }
    sendSpecMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { text, bookingId } = req.body;
            const conversationId = bookingId || req.params.id;
            const userId = req.user!.userId;
            const userRole = req.user!.role;

            // Find receiver (the other party in the booking)
            const booking = await prisma.booking.findUnique({
                where: { id: conversationId },
                select: { customer_id: true, partner_id: true, business_partner_id: true }
            });

            if (!booking) {
                console.warn(`Message attempt for non-existent booking: ${conversationId}`);
                return res.status(404).json({ message: 'Booking not found' });
            }
            // console.log(booking);
            let receiverId: string | null = null;

            if (userRole === 'CUSTOMER') {
                // Verify this is the customer who booked
                if (booking.customer_id !== userId) {
                    return res.status(403).json({ message: 'You are not the customer for this booking' });
                }

                // booking.partner_id is a ServicePartner.id — resolve to User.id
                if (!booking.partner_id) {
                    return res.status(400).json({ message: 'No partner assigned to this booking yet' });
                }
                const servicePartner = await prisma.servicePartner.findUnique({
                    where: { id: booking.partner_id },
                    select: { user_id: true }
                });
                receiverId = servicePartner?.user_id ?? null;
            } else if (userRole === 'SERVICE_PARTNER') {
                // Verify this is the partner assigned to the booking
                const servicePartner = await prisma.servicePartner.findUnique({
                    where: { user_id: userId },
                    select: { id: true }
                });

                if (!servicePartner || servicePartner.id !== booking.partner_id) {
                    return res.status(403).json({ message: 'You are not the assigned partner for this booking' });
                }
                console.log(servicePartner);
                receiverId = booking.customer_id;
            } else if (userRole === 'BUSINESS_PARTNER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
                // Business Partner can message customer if it's their booking
                if (userRole === 'BUSINESS_PARTNER') {
                    const bp = await prisma.businessPartner.findUnique({
                        where: { user_id: userId },
                        select: { id: true }
                    });
                    if (!bp || bp.id !== booking.business_partner_id) {
                        return res.status(403).json({ message: 'You are not the business partner for this booking' });
                    }
                }
                receiverId = booking.customer_id;
            }

            if (!receiverId) {
                return res.status(400).json({ message: 'No participant to receive the message' });
            }

            const message = await this.messageService.sendMessage(
                userId,
                receiverId,
                text,
                conversationId
            );

            return res.status(201).json(successResponse(message, 'Message sent successfully'));
        } catch (error) {
            return next(error);
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
            return next(error);
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
            return next(error);
        }
    };
}
