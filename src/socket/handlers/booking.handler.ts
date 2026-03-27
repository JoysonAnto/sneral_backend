import { Server as SocketIOServer } from 'socket.io';
import prisma from '../../config/database';
import logger from '../../utils/logger';

export const setupBookingHandlers = (io: SocketIOServer) => {
    // Customer namespace
    const customerNamespace = io.of('/customer');

    customerNamespace.on('connection', (socket: any) => {
        logger.info(`Customer connected: ${socket.userId}`);

        // Join user-specific room
        socket.join(socket.userId);

        // Track booking
        socket.on('booking:track', async (bookingId: string) => {
            try {
                const booking = await prisma.booking.findUnique({
                    where: { id: bookingId },
                    include: {
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
                });

                if (booking && booking.customer_id === socket.userId) {
                    // Join booking room for updates
                    socket.join(`booking:${bookingId}`);

                    // Send current booking status
                    socket.emit('booking:status', {
                        bookingId,
                        status: booking.status,
                        partner: booking.partner ? {
                            name: booking.partner.user.full_name,
                            phone: booking.partner.user.phone_number,
                            location: {
                                latitude: booking.partner.current_latitude,
                                longitude: booking.partner.current_longitude,
                            },
                        } : null,
                    });
                }
            } catch (error) {
                logger.error('Error tracking booking:', error);
                socket.emit('error', { message: 'Failed to track booking' });
            }
        });

        // Add bi-directional tracking: Customer updates their live location
        socket.on('booking:update_location', async (data: { booking_id: string; latitude: number; longitude: number; timestamp?: string }) => {
            try {
                // 1. Basic Validation
                if (!data.booking_id || data.latitude === undefined || data.longitude === undefined) {
                    return;
                }

                if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) {
                    return;
                }

                // 2. Fetch booking to find assigned partner
                const booking = await prisma.booking.findUnique({
                    where: { id: data.booking_id },
                    select: {
                        customer_id: true,
                        partner: {
                            select: {
                                user: { select: { id: true } }
                            }
                        }
                    }
                });

                // 3. Authorization check
                if (!booking || booking.customer_id !== socket.userId) {
                    return;
                }

                const updatedAt = data.timestamp || new Date().toISOString();

                // 4. Cache in Redis (TTL 4 hours as requested)
                try {
                    const { setRedisValue } = await import('../../config/redis');
                    await setRedisValue(
                        `booking:customer_location:${data.booking_id}`,
                        JSON.stringify({
                            latitude: data.latitude,
                            longitude: data.longitude,
                            updated_at: updatedAt
                        }),
                        14400 // 4 hours in seconds
                    );
                } catch (redisError) {
                    // Fail silently for redis
                }

                // 5. Broadcast to assigned partner's namespace and specific room (userId)
                if (booking.partner?.user?.id) {
                    partnerNamespace.to(booking.partner.user.id).emit('customer:location_update', {
                        booking_id: data.booking_id,
                        customer_location: {
                            latitude: data.latitude,
                            longitude: data.longitude,
                        },
                        updated_at: updatedAt
                    });
                }

                // 6. Optional: Persist in database for auditing
                await prisma.profile.update({
                    where: { user_id: socket.userId },
                    data: {
                        latitude: data.latitude,
                        longitude: data.longitude
                    }
                }).catch(() => {/* Ignore persistence error */});

            } catch (error) {
                logger.error('Error in customer location broadcast:', error);
            }
        });

        // Stop tracking booking
        socket.on('booking:untrack', (bookingId: string) => {
            socket.leave(`booking:${bookingId}`);
        });

        socket.on('disconnect', () => {
            logger.info(`Customer disconnected: ${socket.userId}`);
        });
    });

    // Partner namespace
    const partnerNamespace = io.of('/partner');

    partnerNamespace.on('connection', (socket: any) => {
        logger.info(`Partner connected: ${socket.userId}`);

        // Join partner-specific room
        socket.join(socket.userId);

        // Accept booking
        socket.on('booking:accept', async (bookingId: string) => {
            try {
                const booking = await prisma.booking.findUnique({
                    where: { id: bookingId },
                    include: { partner: true },
                });

                if (booking && booking.partner?.user_id === socket.userId) {
                    // Emit to customer
                    customerNamespace.to(`booking:${bookingId}`).emit('booking:status_updated', {
                        bookingId,
                        status: 'PARTNER_ACCEPTED',
                        message: 'Partner has accepted your booking',
                    });

                    socket.emit('booking:accepted', { bookingId });
                }
            } catch (error) {
                logger.error('Error accepting booking:', error);
                socket.emit('error', { message: 'Failed to accept booking' });
            }
        });

        // Reject booking
        socket.on('booking:reject', async (data: { bookingId: string; reason: string }) => {
            try {
                const booking = await prisma.booking.findUnique({
                    where: { id: data.bookingId },
                    include: { partner: true },
                });

                if (booking && booking.partner?.user_id === socket.userId) {
                    // Emit to customer
                    customerNamespace.to(`booking:${data.bookingId}`).emit('booking:cancelled', {
                        bookingId: data.bookingId,
                        reason: data.reason,
                        cancelledBy: 'partner',
                    });

                    socket.emit('booking:rejected', { bookingId: data.bookingId });
                }
            } catch (error) {
                logger.error('Error rejecting booking:', error);
            }
        });

        // Update booking status
        socket.on('booking:status_update', async (data: { bookingId: string; status: string }) => {
            try {
                const booking = await prisma.booking.findUnique({
                    where: { id: data.bookingId },
                    include: { partner: true },
                });

                if (booking && booking.partner?.user_id === socket.userId) {
                    // Emit to customer
                    customerNamespace.to(`booking:${data.bookingId}`).emit('booking:status_updated', {
                        bookingId: data.bookingId,
                        status: data.status,
                        timestamp: new Date(),
                    });

                    // Emit to admin
                    io.of('/admin').emit('booking:updated', {
                        bookingId: data.bookingId,
                        status: data.status,
                    });
                }
            } catch (error) {
                logger.error('Error updating booking status:', error);
            }
        });

        // Update location
        socket.on('location:update', async (data: { latitude: number; longitude: number; bookingId?: string; accuracy?: number }) => {
            try {
                const { LocationTrackingService } = await import('../../services/location-tracking.service');
                const locationService = new LocationTrackingService();

                const partner = await prisma.servicePartner.findUnique({
                    where: { user_id: socket.userId },
                });

                if (partner) {
                    await locationService.recordPartnerLocation(
                        partner.id,
                        data.latitude,
                        data.longitude,
                        data.accuracy || 0,
                        data.bookingId
                    );
                }
            } catch (error) {
                logger.error('Error updating location via socket:', error);
            }
        });
        
        // Partner tracks a specific booking to get customer's last known location (reconnection support)
        socket.on('booking:track_customer', async (bookingId: string) => {
            try {
                // Verify the partner is indeed assigned to this booking
                const booking = await prisma.booking.findUnique({
                    where: { id: bookingId },
                    select: { partner: { select: { user: { select: { id: true } } } } }
                });

                if (booking?.partner?.user?.id === socket.userId) {
                    const { getRedisValue } = await import('../../config/redis');
                    const lastLocation = await getRedisValue(`booking:customer_location:${bookingId}`);
                    
                    if (lastLocation) {
                        socket.emit('customer:location_update', {
                            booking_id: bookingId,
                            ...JSON.parse(lastLocation)
                        });
                    }
                }
            } catch (error) {
                logger.error('Error retrieving last known customer location:', error);
            }
        });

        socket.on('disconnect', () => {
            logger.info(`Partner disconnected: ${socket.userId}`);
        });
    });

    // Admin namespace
    const adminNamespace = io.of('/admin');

    adminNamespace.on('connection', (socket: any) => {
        logger.info(`Admin connected: ${socket.userId}`);

        // Admins can monitor all bookings
        socket.on('monitor:bookings', () => {
            socket.join('admin:monitor');
        });

        socket.on('disconnect', () => {
            logger.info(`Admin disconnected: ${socket.userId}`);
        });
    });
};

// Helper function to emit booking updates
export const emitBookingUpdate = (io: SocketIOServer, bookingId: string, status: string, data?: any) => {
    io.of('/customer').to(`booking:${bookingId}`).emit('booking:status_updated', {
        bookingId,
        status,
        ...data,
    });

    io.of('/admin').to('admin:monitor').emit('booking:updated', {
        bookingId,
        status,
        ...data,
    });
};

// Helper function to notify partner of new booking
export const notifyPartnerNewBooking = (io: SocketIOServer, partnerId: string, booking: any) => {
    io.of('/partner').to(partnerId).emit('booking:new_request', {
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        service: booking.items[0]?.service?.name,
        scheduledAt: booking.scheduled_date,
        address: booking.service_address,
        amount: booking.total_amount,
    });
};
