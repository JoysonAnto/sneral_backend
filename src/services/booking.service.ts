import prisma from '../config/database';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { NotificationService } from './notification.service';
import { getIO } from '../socket/socket.server';
import logger from '../utils/logger';

interface BookingItemData {
    serviceId: string;
    quantity: number;
}

interface CreateBookingData {
    items: BookingItemData[];
    scheduledDate: string;
    scheduledTime: string;
    serviceAddress: string;
    serviceLatitude: number;
    serviceLongitude: number;
    paymentMethod?: string;
    specialInstructions?: string;
    businessPartnerId?: string;
    dynamicMultiplier?: number;
}

export class BookingService {
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService();
    }

    async createBooking(customerId: string, data: CreateBookingData) {
        if (!data.items || data.items.length === 0) {
            throw new BadRequestError('No items provided');
        }

        // 1. Fetch all services
        const serviceIds = data.items.map(item => item.serviceId);
        const services = await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            include: { category: true }
        });

        if (services.length !== serviceIds.length) {
            throw new NotFoundError('One or more services not found');
        }

        // 2. Group items by Category
        const itemsByCategory = new Map<string, typeof services>();
        const serviceMap = new Map(services.map(s => [s.id, s]));

        for (const item of data.items) {
            const service = serviceMap.get(item.serviceId)!;
            if (!service.is_active) throw new BadRequestError(`Service ${service.name} is inactive`);

            const categoryId = service.category_id;
            if (!itemsByCategory.has(categoryId)) {
                itemsByCategory.set(categoryId, []);
            }
            itemsByCategory.get(categoryId)!.push(service);
        }

        const createdBookings = [];
        const groupId = itemsByCategory.size > 1 ? `GRP${Date.now()}` : null; // Only group if multiple bookings

        // 3. Create Booking for each Category
        for (const [categoryId, categoryServices] of itemsByCategory) {
            // Generate Booking Number
            const bookingNumber = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

            // Calculate Totals for this Booking
            let totalAmount = 0;
            const bookingItemsData = [];

            for (const service of categoryServices) {
                const itemData = data.items.find(i => i.serviceId === service.id)!;
                const dynamicMultiplier = data.dynamicMultiplier || 1.0;
                const unitPrice = service.base_price;
                const lineTotal = unitPrice * dynamicMultiplier * itemData.quantity; // Assuming multiplier applies to unit price

                totalAmount += lineTotal;
                bookingItemsData.push({
                    service_id: service.id,
                    quantity: itemData.quantity,
                    unit_price: unitPrice,
                    total_price: lineTotal
                });
            }

            const advanceAmount = totalAmount * 0.3;
            const remainingAmount = totalAmount - advanceAmount;

            // Create Booking Record
            const booking = await prisma.booking.create({
                data: {
                    booking_number: bookingNumber,
                    group_id: groupId,
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
                    payment_status: data.paymentMethod === 'CASH' ? 'PENDING' : 'PENDING', // PENDING for online too until webhook
                    special_instructions: data.specialInstructions,
                    business_partner_id: data.businessPartnerId,
                    dynamic_multiplier: data.dynamicMultiplier || 1.0,
                    estimated_duration: categoryServices.reduce((acc, s) => acc + s.duration, 0), // Sum of durations
                    items: {
                        create: bookingItemsData
                    },
                    status_history: {
                        create: {
                            status: 'PENDING',
                            changed_by: customerId,
                            notes: 'Booking created'
                        }
                    }
                } as any,
                include: {
                    items: { include: { service: { include: { category: true } } } },
                    customer: { select: { id: true, email: true, full_name: true, phone_number: true } }
                }
            });

            createdBookings.push(booking);

            // Trigger Partner Matching Logic for this booking
            if (data.businessPartnerId) {
                await this.assignToBusinessPartner(booking, data.businessPartnerId, customerId);
            } else {
                await this.updateBookingStatus(booking.id, 'SEARCHING_PARTNER', customerId, 'Finding available partners');
                this.findAndNotifyPartners(booking.id).catch(err => logger.error(`Assignment error for ${booking.id}:`, err));
            }
        }

        return createdBookings;
    }

    private async assignToBusinessPartner(booking: any, businessPartnerId: string, customerId: string) {
        logger.info(`Direct booking for Business Partner: ${businessPartnerId}`);
        await this.updateBookingStatus(
            booking.id,
            'PENDING_ASSIGNMENT',
            customerId,
            'Waiting for Business Partner to assign a technician'
        );

        const bp = await prisma.businessPartner.findUnique({ where: { id: businessPartnerId } });
        if (bp) {
            const io = getIO();
            io.of('/partner').to(bp.user_id).emit('new_booking', {
                id: booking.id,
                bookingNumber: booking.booking_number,
                // Summary of services in this booking
                service: booking.items.map((i: any) => i.service.name).join(', '),
                customer: booking.customer?.full_name || 'Guest'
            });
        }
    }

    /**
     * Find available partners and notify them about a new booking
     */
    private async findAndNotifyPartners(bookingId: string): Promise<void> {
        try {
            const { PartnerMatchingService } = await import('./partner-matching.service');
            const matchingService = new PartnerMatchingService();

            // Find available partners
            const partners = await matchingService.findAvailablePartners(bookingId);

            // Update status to SEARCHING_PARTNER if any partners found
            if (partners.length > 0) {
                await this.updateBookingStatus(
                    bookingId,
                    'SEARCHING_PARTNER',
                    'system',
                    'Searching for available partners'
                );
            }

            if (partners.length === 0) {
                logger.warn(`No available partners found for booking: ${bookingId}`);
                await this.updateBookingStatus(
                    bookingId,
                    'PARTNER_NOT_FOUND',
                    'system',
                    'No available partners in the area'
                );
                return;
            }

            // Get booking details for notification
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
                            full_name: true,
                        },
                    },
                },
            });

            if (!booking) return;

            const serviceItem = booking.items[0];

            // Notify all matching partners via Socket.IO
            const io = getIO();

            for (const partner of partners) {
                try {
                    // Send real-time notification via Socket.IO in partner namespace
                    io.of('/partner').to(partner.user_id).emit('new_job', {
                        id: booking.id,
                        bookingNumber: booking.booking_number,
                        service: {
                            name: serviceItem.service.name,
                            category: serviceItem.service.category.name,
                        },
                        customer: {
                            name: booking.customer.full_name,
                        },
                        location: booking.service_address,
                        amount: booking.total_amount,
                        scheduledDate: booking.scheduled_date,
                        scheduledTime: booking.scheduled_time,
                        distance: partner.distance,
                    });

                    // Create persistent notification
                    await this.notificationService.createNotification(
                        partner.user_id,
                        'NEW_BOOKING',
                        'New Job Available',
                        `New ${serviceItem.service.name} job available ${partner.distance ? `${partner.distance.toFixed(1)}km away` : 'nearby'}`,
                        { bookingId: booking.id }
                    );

                    logger.info(`Notified partner ${partner.user.full_name} about booking ${booking.booking_number}`);
                } catch (error) {
                    logger.error(`Failed to notify partner ${partner.id}:`, error);
                }
            }

            logger.info(`Successfully notified ${partners.length} partners about booking ${booking.booking_number}`);
        } catch (error) {
            logger.error('Error in findAndNotifyPartners:', error);
            throw error;
        }
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
        const page = Number(filters.page) || 1;
        const limit = Number(filters.limit) || 10;
        const status = filters.status;
        const customerId = filters.customerId;
        const partnerId = filters.partnerId;
        const startDate = filters.startDate;
        const endDate = filters.endDate;

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
                where = {
                    OR: [
                        { partner_id: partner.id },
                        {
                            AND: [
                                { partner_id: null },
                                { status: { in: ['SEARCHING_PARTNER', 'PENDING'] } },
                                { items: { some: { service: { category_id: (partner as any).category_id } } } }
                            ]
                        }
                    ]
                };
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
            } else {
                // If no business partner profile found, return no bookings
                where.id = 'none';
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

        // DEBUG: Log what we're returning
        console.log('🔍 [DEBUG] getAllBookings - userRole:', userRole);
        console.log('🔍 [DEBUG] getAllBookings - userId:', userId);
        console.log('🔍 [DEBUG] getAllBookings - where clause:', JSON.stringify(where, null, 2));
        console.log('🔍 [DEBUG] getAllBookings - Found bookings:', bookings.length);
        console.log('🔍 [DEBUG] getAllBookings - Total count:', total);
        if (bookings.length === 0) {
            // Check if there are ANY bookings for this customer
            const allCustomerBookings = await prisma.booking.findMany({
                where: { customer_id: userId },
                select: { id: true, booking_number: true, status: true, customer_id: true }
            });
            console.log('🔍 [DEBUG] All bookings for customer_id:', userId, ':', allCustomerBookings);
        }

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

        // Trigger Wallet Distribution on Completion
        if (status === 'COMPLETED') {
            try {
                const { WalletService } = await import('./wallet.service');
                const walletService = new WalletService();
                await walletService.distributeEarnings(bookingId);
                logger.info(`Earnings distributed for booking ${bookingId}`);
            } catch (error) {
                logger.error(`Failed to distribute earnings for booking ${bookingId}:`, error);
                // Consider adding a system alert or retry mechanism here
            }
        }

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
                        const partner = await prisma.servicePartner.findUnique({
                            where: { id: partnerId }
                        });
                        if (partner) {
                            await this.notificationService.createNotification(
                                partner.user_id,
                                'GENERAL',
                                'Booking Cancelled',
                                `Booking ${booking.booking_number} has been cancelled.`,
                                { bookingId: booking.id }
                            );
                        }
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

        const allowedStatuses: string[] = ['SEARCHING_PARTNER', 'PENDING', 'PENDING_ASSIGNMENT'];
        if (!allowedStatuses.includes(booking.status)) {
            throw new BadRequestError('Booking cannot be assigned in current status');
        }

        // Permission Check: If it's a BP booking, only BP owner or Admin can assign
        const bpIdOfBooking = (booking as any).business_partner_id;
        if (bpIdOfBooking) {
            const actingBp = await prisma.businessPartner.findFirst({
                where: { user_id: assignedBy }
            });

            // If the user is a BP, they must own the BP record assigned to this booking
            if (actingBp && actingBp.id !== bpIdOfBooking) {
                throw new UnauthorizedError('You are not authorized to assign technicians for this business');
            }

            // Ensure the technician belongs to this BP's team
            const association = await prisma.partnerAssociation.findFirst({
                where: {
                    business_partner_id: bpIdOfBooking,
                    service_partner_id: partnerId,
                    status: 'ACTIVE'
                }
            });

            if (!association) {
                throw new BadRequestError('The selected technician is not a member of your active team');
            }
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
        console.log(`🔍 [SERVICE DEBUG] acceptBooking: booking=${bookingId}, partner=${partnerId}`);
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { partner: true },
        });

        if (!booking) {
            console.log(`❌ [SERVICE DEBUG] Booking not found: ${bookingId}`);
            throw new NotFoundError('Booking not found');
        }

        console.log(`🔍 [SERVICE DEBUG] Booking current status: ${booking.status}, active partner: ${booking.partner_id}`);

        // FIFO Claiming logic: If no partner is assigned, allow claiming
        if (!booking.partner_id) {
            if (booking.status !== 'SEARCHING_PARTNER' && booking.status !== 'PENDING') {
                console.log(`❌ [SERVICE DEBUG] Not claimable. Status: ${booking.status}`);
                throw new BadRequestError('Booking is no longer available for claiming');
            }

            // Assign the partner and update status to PARTNER_ACCEPTED directly (claiming)
            return await prisma.booking.update({
                where: { id: bookingId },
                data: {
                    partner_id: partnerId,
                    partner_assigned_at: new Date(),
                    partner_accepted_at: new Date(),
                    status: 'PARTNER_ACCEPTED',
                    status_history: {
                        create: {
                            status: 'PARTNER_ACCEPTED',
                            changed_by: partnerId,
                            notes: 'Partner claimed and accepted the booking',
                        },
                    },
                },
                include: {
                    customer: true,
                    partner: {
                        include: { user: true }
                    }
                }
            });
        }

        // Traditional acceptance logic (if already assigned)
        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('This booking has already been claimed by another partner');
        }

        if (booking.status !== 'PARTNER_ASSIGNED') {
            throw new BadRequestError('Booking cannot be accepted in current status');
        }

        return await this.updateBookingStatus(
            bookingId,
            'PARTNER_ACCEPTED',
            partnerId,
            'Partner accepted the assigned booking'
        );
    }

    async startBooking(bookingId: string, partnerId: string, otp?: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('Not assigned to this booking');
        }

        if (booking.status !== 'PARTNER_ACCEPTED' && booking.status !== 'ARRIVED') {
            throw new BadRequestError('Booking must be accepted or arrived before starting');
        }

        // Verify start OTP if provided
        if (otp && (booking as any).start_otp !== otp) {
            throw new BadRequestError('Invalid Start OTP. Please ask the customer for the correct code.');
        }

        return await this.updateBookingStatus(
            bookingId,
            'IN_PROGRESS',
            partnerId,
            'Service started'
        );
    }

    /**
     * Partner marks arrival at service location
     */
    async arriveAtLocation(bookingId: string, partnerId: string, currentLatitude: number, currentLongitude: number) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                partner: {
                    include: { user: true }
                },
                customer: true
            },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('Not assigned to this booking');
        }

        if (booking.status !== 'PARTNER_ACCEPTED') {
            throw new BadRequestError('Can only mark arrival after accepting the booking');
        }

        // Calculate distance to verify arrival (within 500m)
        const distance = this.calculateDistance(
            currentLatitude,
            currentLongitude,
            booking.service_latitude,
            booking.service_longitude
        );

        if (distance > 0.5) {
            throw new BadRequestError(`You must be within 500m of the service location. Current distance: ${(distance * 1000).toFixed(0)}m`);
        }

        // Update partner's current location
        await prisma.servicePartner.update({
            where: { id: partnerId },
            data: {
                current_latitude: currentLatitude,
                current_longitude: currentLongitude,
                last_location_update: new Date(),
            },
        });

        const updatedBooking = await this.updateBookingStatus(
            bookingId,
            'ARRIVED',
            partnerId,
            'Partner arrived at service location'
        );

        // Notify customer
        try {
            await this.notificationService.createNotification(
                booking.customer_id,
                'GENERAL',
                'Technician Arrived',
                `${booking.partner?.user.full_name || 'Your technician'} has arrived at your location.`,
                { bookingId: booking.id }
            );
        } catch (error) {
            logger.error('Failed to send arrival notification:', error);
        }

        return updatedBooking;
    }

    /**
     * Upload before-service photos
     */
    async uploadBeforeServicePhotos(bookingId: string, partnerId: string, imageUrls: string[]) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('Not assigned to this booking');
        }

        if (booking.status !== 'ARRIVED' && booking.status !== 'IN_PROGRESS') {
            throw new BadRequestError('Can only upload photos after arrival');
        }

        await prisma.booking.update({
            where: { id: bookingId },
            data: { before_service_images: imageUrls },
        });

        return { message: 'Before-service photos uploaded successfully', imageUrls };
    }

    /**
     * Upload after-service photos
     */
    async uploadAfterServicePhotos(bookingId: string, partnerId: string, imageUrls: string[]) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.partner_id !== partnerId) {
            throw new UnauthorizedError('Not assigned to this booking');
        }

        if (booking.status !== 'IN_PROGRESS') {
            throw new BadRequestError('Can only upload after-service photos during service');
        }

        await prisma.booking.update({
            where: { id: bookingId },
            data: { after_service_images: imageUrls },
        });

        return { message: 'After-service photos uploaded successfully', imageUrls };
    }

    /**
     * Generate OTP for service start verification
     */
    async generateStartOTP(bookingId: string): Promise<string> {
        const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit PIN for start

        await prisma.booking.update({
            where: { id: bookingId },
            data: { start_otp: otp } as any,
        });

        return otp;
    }

    /**
     * Generate OTP for service completion verification
     */
    async generateCompletionOTP(bookingId: string): Promise<string> {
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

        await prisma.booking.update({
            where: { id: bookingId },
            data: { completion_otp: otp },
        });

        return otp;
    }

    /**
     * Verify completion OTP and complete booking
     */
    async verifyCompletionOTP(bookingId: string, partnerId: string, otp: string, serviceNotes?: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                business_partner: true,
                items: {
                    include: {
                        service: true,
                    },
                },
            } as any,
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

        // Verify OTP
        if (booking.completion_otp !== otp) {
            throw new BadRequestError('Invalid OTP. Please ask the customer for the correct code.');
        }

        // Check if service photos were uploaded
        if (!booking.before_service_images || booking.before_service_images.length === 0) {
            throw new BadRequestError('Please upload before-service photos first');
        }

        if (!booking.after_service_images || booking.after_service_images.length === 0) {
            throw new BadRequestError('Please upload after-service photos first');
        }

        // Update service notes if provided
        if (serviceNotes) {
            await prisma.booking.update({
                where: { id: bookingId },
                data: { service_notes: serviceNotes },
            });
        }

        // Now complete the booking (existing logic)
        return await this.completeBooking(bookingId, partnerId);
    }

    /**
     * Update partner's real-time location
     */
    async updatePartnerLocation(partnerId: string, latitude: number, longitude: number) {
        await prisma.servicePartner.update({
            where: { id: partnerId },
            data: {
                current_latitude: latitude,
                current_longitude: longitude,
                last_location_update: new Date(),
            },
        });

        // Broadcast location update via Socket.IO
        try {
            const io = getIO();
            const partner = await prisma.servicePartner.findUnique({
                where: { id: partnerId },
                include: { bookings: { where: { status: { in: ['PARTNER_ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } } } },
            });

            if (partner && partner.bookings.length > 0) {
                // Notify customers of active bookings
                partner.bookings.forEach(booking => {
                    io.of('/customer').to(booking.customer_id).emit('partner:location_update', {
                        bookingId: booking.id,
                        latitude,
                        longitude,
                        timestamp: new Date(),
                    });
                });
            }
        } catch (error) {
            logger.warn('Failed to broadcast location update:', error);
        }

        return { message: 'Location updated successfully', latitude, longitude };
    }

    /**
     * Calculate distance between two coordinates (in km)
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the Earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) *
            Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    async completeBooking(bookingId: string, partnerId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: { include: { service: true } },
            } as any,
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

        // Record completion time
        const completedAt = new Date();
        const startedAt = booking.started_at || booking.updated_at;
        const actualDurationMinutes = Math.ceil((completedAt.getTime() - startedAt.getTime()) / (1000 * 60));

        // Calculate Overtime Charges
        let finalTotalAmount = booking.total_amount;
        let overtimeCharge = 0;
        const estimatedDuration = (booking as any).estimated_duration || 0;

        if (estimatedDuration > 0 && actualDurationMinutes > estimatedDuration) {
            const overtimeMinutes = actualDurationMinutes - estimatedDuration;
            // Charge 10% of base price for every 15 mins overtime as an example
            const serviceItem = (booking as any).items?.[0];
            const serviceBasePrice = serviceItem?.service?.base_price || 0;
            const chargePer15Min = serviceBasePrice * 0.1;
            overtimeCharge = Math.ceil(overtimeMinutes / 15) * chargePer15Min;
            finalTotalAmount += overtimeCharge;

            logger.info(`Booking ${booking.booking_number} completed with overtime: ${overtimeMinutes} mins. Charge: ${overtimeCharge}`);
        }

        // Update booking with duration and overtime info
        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                actual_duration: actualDurationMinutes,
                overtime_charge: overtimeCharge,
                total_amount: finalTotalAmount,
                remaining_amount: finalTotalAmount - (booking.advance_amount || 0)
            } as any
        });

        // ---------------------------------------------------------
        // Financial Split Logic has been moved to WalletService.distributeEarnings
        // which is triggered by updateBookingStatus('COMPLETED')
        // ---------------------------------------------------------

        // Generate invoice (This could also be moved to distributeEarnings, but keeping here for now as artifact generation)
        // Actually, distributeEarnings relies on finalized amounts.
        // Create Invoice Record
        await prisma.invoice.create({
            data: {
                invoice_number: `INV${Date.now()}`,
                booking_id: bookingId,
                subtotal: finalTotalAmount,
                tax_amount: finalTotalAmount * 0.18, // 18% GST (Display purpose on Invoice)
                discount_amount: 0,
                total_amount: finalTotalAmount * 1.18,
            } as any, // Cast as any because schema might differ slightly or strict checks
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

        if (refundAmount > 0) {
            const { PaymentService } = await import('./payment.service');
            const paymentService = new PaymentService();
            await paymentService.processRefund(bookingId, refundAmount, `Cancellation refund: ${reason}`, userId);
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
                rated_id: (booking as any).partner?.user_id || (booking as any).partner_id,
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
