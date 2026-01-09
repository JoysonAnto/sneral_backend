import prisma from '../config/database';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';
import { getIO } from '../socket/socket.server';
import logger from '../utils/logger';

interface CreateBookingData {
    serviceId: string;
    scheduledDate: string;
    scheduledTime: string;
    serviceAddress: string;
    serviceLatitude: number;
    serviceLongitude: number;
    paymentMethod?: string;
    specialInstructions?: string;
}

export class BookingService {
    private emailService: EmailService;
    private notificationService: NotificationService;

    constructor() {
        this.emailService = new EmailService();
        this.notificationService = new NotificationService();
    }

    async createBooking(customerId: string, data: CreateBookingData) {
        // Get service details
        const service = await prisma.service.findUnique({
            where: { id: data.serviceId },
            include: { category: true },
        });

        if (!service || !service.is_active) {
            throw new NotFoundError('Service not found or inactive');
        }

        // Generate unique booking number
        const bookingNumber = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Calculate amounts (30% advance)
        const totalAmount = service.base_price;
        const advanceAmount = totalAmount * 0.3;
        const remainingAmount = totalAmount - advanceAmount;

        // Create booking
        const booking = await prisma.booking.create({
            data: {
                booking_number: bookingNumber,
                customer_id: customerId,
                status: 'PENDING',
                scheduled_date: new Date(data.scheduledDate),
                scheduled_time: data.scheduledTime,
                service_address: data.serviceAddress,
                service_latitude: data.serviceLatitude,
                service_longitude: data.serviceLongitude,
                total_amount: totalAmount,
                advance_amount: advanceAmount,
                remaining_amount: remainingAmount,
                payment_method: data.paymentMethod as any,
                payment_status: data.paymentMethod === 'CASH' ? 'PENDING' : 'PENDING',
                special_instructions: data.specialInstructions,
                items: {
                    create: {
                        service_id: service.id,
                        quantity: 1,
                        unit_price: service.base_price,
                        total_price: service.base_price,
                    },
                },
                status_history: {
                    create: {
                        status: 'PENDING',
                        changed_by: customerId,
                        notes: 'Booking created',
                    },
                },
            },
            include: {
                items: {
                    include: {
                        service: {
                            include: {
                                category: true,
                            },
                        },
                    },
                },
                customer: {
                    select: {
                        id: true,
                        email: true,
                        full_name: true,
                        phone_number: true,
                    },
                },
            },
        });

        // TODO: Trigger partner assignment algorithm
        // For now, update status to SEARCHING_PARTNER
        await this.updateBookingStatus(booking.id, 'SEARCHING_PARTNER', customerId, 'Finding available partners');

        return booking;
    }

    async getBookingById(bookingId: string, userId: string, userRole: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: {
                    include: {
                        service: {
                            include: {
                                category: true,
                            },
                        },
                    },
                },
                customer: {
                    select: {
                        id: true,
                        email: true,
                        full_name: true,
                        phone_number: true,
                        profile: true,
                    },
                },
                partner: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                full_name: true,
                                phone_number: true,
                            },
                        },
                    },
                },
                payments: true,
                rating: true,
                status_history: {
                    orderBy: {
                        created_at: 'desc',
                    },
                },
            },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        // Check permissions
        if (
            userRole !== 'SUPER_ADMIN' &&
            userRole !== 'ADMIN' &&
            booking.customer_id !== userId &&
            booking.partner?.user_id !== userId
        ) {
            throw new UnauthorizedError('Access denied');
        }

        return booking;
    }

    async getAllBookings(filters: any, userId: string, userRole: string) {
        const {
            page = 1,
            limit = 10,
            status,
            customerId,
            partnerId,
            startDate,
            endDate,
        } = filters;

        const skip = (page - 1) * limit;

        // Build where clause based on role
        let where: any = {};

        if (userRole === 'CUSTOMER') {
            where.customer_id = userId;
        } else if (userRole === 'SERVICE_PARTNER') {
            const partner = await prisma.servicePartner.findUnique({
                where: { user_id: userId },
            });
            if (partner) {
                where.partner_id = partner.id;
            }
        } else if (userRole === 'BUSINESS_PARTNER') {
            // Business partners can see bookings of their service partners
            const businessPartner = await prisma.businessPartner.findUnique({
                where: { user_id: userId },
                include: {
                    service_partners: true,
                },
            });
            if (businessPartner) {
                where.partner_id = {
                    in: businessPartner.service_partners.map(sp => sp.id),
                };
            }
        }

        // Apply additional filters
        if (status) where.status = status;
        if (customerId) where.customer_id = customerId;
        if (partnerId) where.partner_id = partnerId;
        if (startDate || endDate) {
            where.scheduled_date = {};
            if (startDate) where.scheduled_date.gte = new Date(startDate);
            if (endDate) where.scheduled_date.lte = new Date(endDate);
        }

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    items: {
                        include: {
                            service: {
                                include: {
                                    category: true,
                                },
                            },
                        },
                    },
                    customer: {
                        select: {
                            id: true,
                            email: true,
                            full_name: true,
                            phone_number: true,
                        },
                    },
                    partner: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    full_name: true,
                                    phone_number: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.booking.count({ where }),
        ]);

        return {
            bookings,
            pagination: {
                page,
                limit,
                total,
            },
        };
    }

    async updateBookingStatus(
        bookingId: string,
        status: string,
        userId: string,
        notes?: string
    ) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        // Update booking and create history record
        const updatedBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                status: status as any,
                ...(status === 'PARTNER_ASSIGNED' && { partner_assigned_at: new Date() }),
                ...(status === 'PARTNER_ACCEPTED' && { partner_accepted_at: new Date() }),
                ...(status === 'IN_PROGRESS' && { started_at: new Date() }),
                ...(status === 'COMPLETED' && { completed_at: new Date() }),
                ...(status === 'CANCELLED' && {
                    cancelled_at: new Date(),
                    cancelled_by: userId,
                    cancellation_reason: notes,
                }),
                status_history: {
                    create: {
                        status: status as any,
                        changed_by: userId,
                        notes,
                    },
                },
            },
            include: {
                customer: true,
                partner: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        // Emit Socket.IO event for real-time updates
        this.broadcastBookingUpdate(updatedBooking);

        // Send notifications based on status
        this.sendBookingNotifications(updatedBooking, notes);

        return updatedBooking;
    }

    private async broadcastBookingUpdate(booking: any) {
        try {
            const io = getIO();
            const updateData = {
                id: booking.id,
                status: booking.status,
                bookingNumber: booking.booking_number,
                updatedAt: booking.updated_at,
            };

            // Notify Customer
            io.of('/customer').to(booking.customer_id).emit('booking:update', updateData);

            // Notify Partner if assigned
            if (booking.partner?.user_id) {
                io.of('/partner').to(booking.partner.user_id).emit('booking:update', updateData);
            }

            // Notify Admins
            io.of('/admin').emit('booking:update', updateData);
        } catch (error) {
            logger.warn('Failed to broadcast booking update:', error);
        }
    }

    private async sendBookingNotifications(booking: any, notes?: string) {
        const customerId = booking.customer_id;
        const partnerId = booking.partner?.user_id;

        try {
            switch (booking.status) {
                case 'PARTNER_ACCEPTED':
                    await this.notificationService.createNotification(
                        customerId,
                        'BOOKING_ASSIGNED',
                        'Technician Assigned',
                        `Your booking ${booking.booking_number} has been accepted by ${booking.partner.user.full_name}.`,
                        { bookingId: booking.id }
                    );
                    break;
                case 'IN_PROGRESS':
                    await this.notificationService.createNotification(
                        customerId,
                        'BOOKING_COMPLETED', // Using a generic type for now or add TECH_ARRIVED
                        'Technician Arrived',
                        `Your technician ${booking.partner.user.full_name} has arrived and started the service.`,
                        { bookingId: booking.id }
                    );
                    break;
                case 'COMPLETED':
                    await this.notificationService.createNotification(
                        customerId,
                        'BOOKING_COMPLETED',
                        'Service Completed',
                        `Your service for booking ${booking.booking_number} is completed. Please rate our service.`,
                        { bookingId: booking.id }
                    );
                    break;
                case 'CANCELLED':
                    await this.notificationService.createNotification(
                        customerId,
                        'GENERAL',
                        'Booking Cancelled',
                        `Your booking ${booking.booking_number} has been cancelled. ${notes || ''}`,
                        { bookingId: booking.id }
                    );
                    if (partnerId) {
                        await this.notificationService.createNotification(
                            partnerId,
                            'GENERAL',
                            'Booking Cancelled',
                            `Booking ${booking.booking_number} has been cancelled.`,
                            { bookingId: booking.id }
                        );
                    }
                    break;
            }
        } catch (error) {
            logger.error('Failed to send booking notification:', error);
        }
    }

    async assignPartner(bookingId: string, partnerId: string, assignedBy: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.status !== 'SEARCHING_PARTNER' && booking.status !== 'PENDING') {
            throw new BadRequestError('Booking cannot be assigned in current status');
        }

        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
            include: { user: true },
        });

        if (!partner || partner.availability_status !== 'AVAILABLE') {
            throw new BadRequestError('Partner not available');
        }

        // Assign partner
        const updatedBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                partner_id: partnerId,
                partner_assigned_at: new Date(),
                status: 'PARTNER_ASSIGNED',
                status_history: {
                    create: {
                        status: 'PARTNER_ASSIGNED',
                        changed_by: assignedBy,
                        notes: `Assigned to ${partner.user.full_name}`,
                    },
                },
            },
            include: {
                customer: true,
                partner: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        // Notify partner via Socket.IO
        try {
            const io = getIO();
            io.of('/partner').to(partner.user_id).emit('booking:new_assignment', {
                id: updatedBooking.id,
                bookingNumber: updatedBooking.booking_number,
                totalAmount: updatedBooking.total_amount,
                serviceAddress: updatedBooking.service_address,
            });

            // Also send persistent notification
            await this.notificationService.createNotification(
                partner.user_id,
                'BOOKING_ASSIGNED',
                'New Job Assigned',
                `You have been assigned a new job: ${updatedBooking.booking_number}.`,
                { bookingId: updatedBooking.id }
            );
        } catch (error) {
            logger.warn('Failed to notify partner of assignment:', error);
        }

        // Also broadcast update to customer
        this.broadcastBookingUpdate(updatedBooking);

        return updatedBooking;
    }

    async acceptBooking(bookingId: string, partnerId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { partner: true },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('Not assigned to this booking');
        }

        if (booking.status !== 'PARTNER_ASSIGNED') {
            throw new BadRequestError('Booking cannot be accepted in current status');
        }

        return await this.updateBookingStatus(
            bookingId,
            'PARTNER_ACCEPTED',
            partnerId,
            'Partner accepted the booking'
        );
    }

    async startBooking(bookingId: string, partnerId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('Not assigned to this booking');
        }

        if (booking.status !== 'PARTNER_ACCEPTED') {
            throw new BadRequestError('Booking must be accepted before starting');
        }

        return await this.updateBookingStatus(
            bookingId,
            'IN_PROGRESS',
            partnerId,
            'Service started'
        );
    }

    async completeBooking(bookingId: string, partnerId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: {
                    include: {
                        service: true,
                    },
                },
            },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('Not assigned to this booking');
        }

        if (booking.status !== 'IN_PROGRESS') {
            throw new BadRequestError('Booking must be in progress to complete');
        }

        // Generate invoice
        await prisma.invoice.create({
            data: {
                invoice_number: `INV${Date.now()}`,
                booking_id: bookingId,
                subtotal: booking.total_amount,
                tax_amount: booking.total_amount * 0.18, // 18% GST
                discount_amount: 0,
                total_amount: booking.total_amount * 1.18,
            },
        });

        // Update partner stats
        await prisma.servicePartner.update({
            where: { id: partnerId },
            data: {
                total_bookings: { increment: 1 },
                completed_bookings: { increment: 1 },
            },
        });

        return await this.updateBookingStatus(
            bookingId,
            'COMPLETED',
            partnerId,
            'Service completed'
        );
    }

    async cancelBooking(bookingId: string, userId: string, reason: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        // Check if user can cancel
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
        });

        const canCancel =
            booking.customer_id === userId ||
            booking.partner_id === partner?.id;

        if (!canCancel) {
            throw new UnauthorizedError('You cannot cancel this booking');
        }

        // Check if cancellation is allowed
        if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
            throw new BadRequestError('Cannot cancel booking in current status');
        }

        // Calculate refund amount based on cancellation time
        let refundAmount = 0;
        if (booking.payment_status === 'COMPLETED') {
            const hoursUntilService = (new Date(booking.scheduled_date).getTime() - Date.now()) / (1000 * 60 * 60);

            if (hoursUntilService > 24) {
                refundAmount = booking.total_amount * 0.9; // 90% refund
            } else if (hoursUntilService > 2) {
                refundAmount = booking.total_amount * 0.5; // 50% refund
            }
            // Less than 2 hours: no refund
        }

        return await this.updateBookingStatus(
            bookingId,
            'CANCELLED',
            userId,
            reason
        );
    }

    async rateBooking(bookingId: string, customerId: string, rating: number, review?: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { partner: true },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.customer_id !== customerId) {
            throw new UnauthorizedError('Only the customer can rate this booking');
        }

        if (booking.status !== 'COMPLETED') {
            throw new BadRequestError('Can only rate completed bookings');
        }

        if (!booking.partner_id) {
            throw new BadRequestError('No partner assigned to rate');
        }

        // Check if already rated
        const existingRating = await prisma.rating.findUnique({
            where: { booking_id: bookingId },
        });

        if (existingRating) {
            throw new BadRequestError('Booking already rated');
        }

        // Create rating
        await prisma.rating.create({
            data: {
                booking_id: bookingId,
                rater_id: customerId,
                rated_id: booking.partner.user_id,
                rating,
                review,
            },
        });

        // Update partner average rating
        const partner = await prisma.servicePartner.findUnique({
            where: { id: booking.partner_id },
        });

        if (partner) {
            const totalRatings = partner.total_ratings + 1;
            const newAvgRating =
                ((partner.avg_rating * partner.total_ratings) + rating) / totalRatings;

            await prisma.servicePartner.update({
                where: { id: booking.partner_id },
                data: {
                    avg_rating: newAvgRating,
                    total_ratings: totalRatings,
                },
            });
        }

        // Update booking status to RATED
        await this.updateBookingStatus(
            bookingId,
            'RATED',
            customerId,
            'Customer provided rating'
        );

        return { message: 'Rating submitted successfully' };
    }
}
