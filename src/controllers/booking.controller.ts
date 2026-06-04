import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service';
import { MessageService } from '../services/message.service';
import { successResponse } from '../utils/response';

export class BookingController {
    private bookingService: BookingService;
    private messageService: MessageService;

    constructor() {
        this.bookingService = new BookingService();
        this.messageService = new MessageService();
    }

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Check if serviceId is passed directly at the root (shorthand/legacy)
            if (req.body.serviceId && (!req.body.items || req.body.items.length === 0)) {
                req.body.items = [{
                    serviceId: req.body.serviceId,
                    quantity: req.body.quantity || 1
                }];
            }

            const bookings = await this.bookingService.createBooking(
                req.user!.userId,
                req.body
            );
            res.status(201).json(successResponse(bookings, 'Bookings created successfully'));
        } catch (error) {
            next(error);
        }
    };

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            console.log(`🔍 [BOOKING DEBUG] getAll called by user: ${req.user?.userId}, role: ${req.user?.role}`);
            const result = await this.bookingService.getAllBookings(
                req.query,
                req.user!.userId,
                req.user!.role
            );
            console.log(`🔍 [BOOKING DEBUG] Found ${result.bookings.length} bookings`);
            res.json(
                successResponse(
                    result.bookings,
                    'Bookings retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.getBookingById(
                req.params.id,
                req.user!.userId,
                req.user!.role
            );
            res.json(successResponse(booking, 'Booking retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.updateBookingStatus(
                req.params.id,
                req.body.status,
                req.user!.userId,
                req.body.notes
            );
            res.json(successResponse(booking, 'Booking status updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    assignPartner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.assignPartner(
                req.params.id,
                req.body.partnerId,
                req.user!.userId
            );
            res.json(successResponse(booking, 'Partner assigned successfully'));
        } catch (error) {
            next(error);
        }
    };

    acceptBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            console.log(`🔍 [ACCEPT DEBUG] Partner ${req.user?.userId} attempting to accept booking ${req.params.id}`);
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                console.log(`❌ [ACCEPT DEBUG] Partner profile not found for user ${req.user?.userId}`);
                throw new Error('Service partner profile not found');
            }

            console.log(`🔍 [ACCEPT DEBUG] Found partner ${partner.id}. Calling service...`);
            const booking = await this.bookingService.acceptBooking(
                req.params.id,
                partner.id
            );
            console.log(`✅ [ACCEPT DEBUG] Successfully accepted booking ${req.params.id}`);
            res.json(successResponse(booking, 'Booking accepted successfully'));
        } catch (error: any) {
            console.error(`❌ [ACCEPT DEBUG] Error:`, error);
            next(error);
        }
    };

    rejectBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const booking = await this.bookingService.rejectBooking(
                req.params.id,
                partner.id,
                req.body.reason
            );
            res.json(successResponse(booking, 'Booking rejected successfully'));
        } catch (error) {
            next(error);
        }
    };

    startBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const booking = await this.bookingService.startBooking(
                req.params.id,
                partner.id,
                req.body.otp
            );
            res.json(successResponse(booking, 'Booking started successfully'));
        } catch (error) {
            next(error);
        }
    };

    completeBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const booking = await this.bookingService.completeBooking(
                req.params.id,
                partner.id
            );
            res.json(successResponse(booking, 'Booking completed successfully'));
        } catch (error) {
            next(error);
        }
    };

    cancel = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.cancelBooking(
                req.params.id,
                req.user!.userId,
                req.user!.role,
                req.body.reason
            );
            res.json(successResponse(booking, 'Booking cancelled successfully'));
        } catch (error) {
            next(error);
        }
    };

    rate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.bookingService.rateBooking(
                req.params.id,
                req.user!.userId,
                req.body.rating,
                req.body.review
            );
            res.json(successResponse(result, 'Rating submitted successfully'));
        } catch (error) {
            next(error);
        }
    };

    // New methods for service progress and completion
    arriveAtLocation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { latitude, longitude } = req.body;
            const booking = await this.bookingService.arriveAtLocation(
                req.params.id,
                partner.id,
                latitude,
                longitude
            );
            res.json(successResponse(booking, 'Arrival confirmed successfully'));
        } catch (error) {
            next(error);
        }
    };

    uploadBeforePhotos = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { imageUrls } = req.body;
            if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
                throw new Error('No image URLs provided');
            }

            const result = await this.bookingService.uploadBeforeServicePhotos(
                req.params.id,
                partner.id,
                imageUrls
            );
            res.json(successResponse(result, 'Before-service photos uploaded successfully'));
        } catch (error) {
            next(error);
        }
    };

    uploadAfterPhotos = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { imageUrls } = req.body;
            if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
                throw new Error('No image URLs provided');
            }

            const result = await this.bookingService.uploadAfterServicePhotos(
                req.params.id,
                partner.id,
                imageUrls
            );
            res.json(successResponse(result, 'After-service photos uploaded successfully'));
        } catch (error) {
            next(error);
        }
    };

    generateStartOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const otp = await this.bookingService.generateStartOTP(req.params.id);
            res.json(successResponse({ otp }, 'Start OTP generated successfully'));
        } catch (error) {
            next(error);
        }
    };

    generateCompletionOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const otp = await this.bookingService.generateCompletionOTP(req.params.id);
            res.json(successResponse({ otp }, 'OTP generated successfully'));
        } catch (error) {
            next(error);
        }
    };

    verifyCompletionOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { otp, serviceNotes } = req.body;
            const result = await this.bookingService.verifyCompletionOTP(
                req.params.id,
                partner.id,
                otp,
                serviceNotes
            );
            res.json(successResponse(result, 'Service completed successfully'));
        } catch (error) {
            next(error);
        }
    };

    updatePartnerLocation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { latitude, longitude } = req.body;
            const result = await this.bookingService.updatePartnerLocation(
                partner.id,
                latitude,
                longitude
            );
            res.json(successResponse(result, 'Location updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    addMaterialCost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { amount, billImageUrl } = req.body;

            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                res.status(400).json({ success: false, message: 'A valid positive amount is required' });
                return;
            }

            // Get partner ID from the authenticated service partner
            const prismaClient = await import('../config/database');
            const servicePartner = await prismaClient.default.servicePartner.findUnique({
                where: { user_id: req.user!.userId },
            });

            if (!servicePartner) {
                res.status(403).json({ success: false, message: 'Service partner not found' });
                return;
            }

            const updated = await this.bookingService.addMaterialCost(
                id,
                servicePartner.id,
                Number(amount),
                billImageUrl
            );

            res.json(successResponse(updated, 'Material cost added successfully'));
        } catch (error) {
            next(error);
        }
    };

    sendVoiceMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const bookingId = req.params.id || req.body.booking_id;
            const { audio_url, duration_seconds } = req.body;
            const userId = req.user!.userId;

            // 1. Verify access to this booking
            const prismaClient = await import('../config/database');
            const prisma = prismaClient.default;
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                select: { customer_id: true, partner_id: true, business_partner_id: true }
            });

            if (!booking) {
                res.status(404).json({ success: false, message: 'Booking not found' });
                return;
            }

            // 2. Resolve receiver ID
            let receiverId: string | null = null;
            if (req.user!.role === 'CUSTOMER') {
                if (booking.customer_id !== userId) {
                    res.status(403).json({ success: false, message: 'You are not the customer for this booking' });
                    return;
                }
                if (!booking.partner_id) {
                    res.status(400).json({ success: false, message: 'No partner assigned to this booking yet' });
                    return;
                }
                const servicePartner = await prisma.servicePartner.findUnique({
                    where: { id: booking.partner_id },
                    select: { user_id: true }
                });
                receiverId = servicePartner?.user_id ?? null;
            } else if (req.user!.role === 'SERVICE_PARTNER') {
                const servicePartner = await prisma.servicePartner.findUnique({
                    where: { user_id: userId },
                    select: { id: true }
                });
                if (!servicePartner || servicePartner.id !== booking.partner_id) {
                    res.status(403).json({ success: false, message: 'You are not the assigned partner for this booking' });
                    return;
                }
                receiverId = booking.customer_id;
            } else {
                receiverId = booking.customer_id;
            }

            if (!receiverId) {
                res.status(400).json({ success: false, message: 'No participant to receive the message' });
                return;
            }

            // 3. Send voice message
            const formattedMessage = await this.messageService.sendMessage(
                userId,
                receiverId,
                'Sent a voice note',
                bookingId,
                'voice',
                audio_url,
                duration_seconds ? Number(duration_seconds) : undefined
            );

            res.status(201).json({
                success: true,
                message: "Voice message sent successfully",
                data: formattedMessage
            });
        } catch (error) {
            next(error);
        }
    };

    getVoiceMessages = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const bookingId = req.params.id;
            const prismaClient = await import('../config/database');
            const prisma = prismaClient.default;

            const messages = await prisma.message.findMany({
                where: {
                    booking_id: bookingId,
                    content_type: { in: ['voice', 'audio'] }
                },
                include: {
                    sender: {
                        select: {
                            role: true
                        }
                    }
                },
                orderBy: { created_at: 'asc' }
            });

            const formattedMessages = messages.map(msg => ({
                message_id: msg.id,
                booking_id: msg.booking_id || bookingId,
                sender_id: msg.sender_id,
                sender_type: msg.sender?.role === 'CUSTOMER' ? 'customer' : 'worker',
                audio_url: msg.file_url || msg.content,
                duration_seconds: msg.duration_seconds || 0,
                created_at: msg.created_at
            }));

            res.json({
                success: true,
                messages: formattedMessages
            });
        } catch (error) {
            next(error);
        }
    };
}

