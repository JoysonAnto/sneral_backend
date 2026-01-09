import { Server as SocketIOServer } from 'socket.io';
import prisma from '../../config/database';
import logger from '../../utils/logger';

export const setupBookingHandlers = (io: SocketIOServer) => {
    // Customer namespace
    const customerNamespace = io.of('/customer');

    customerNamespace.on('connection', (socket: any) => {
        logger.info(`Customer connected: ${socket.userId}`);

        // Join user-specific room
        socket.join(`user:${socket.userId}`);

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
        socket.join(`user:${socket.userId}`);

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
        socket.on('location:update', async (data: { latitude: number; longitude: number }) => {
            try {
                const partner = await prisma.servicePartner.findUnique({
                    where: { user_id: socket.userId },
                });

                if (partner) {
                    // Update partner location in database
                    await prisma.servicePartner.update({
                        where: { id: partner.id },
                        data: {
                            current_latitude: data.latitude,
                            current_longitude: data.longitude,
                        },
                    });

                    // Get active bookings for this partner
                    const activeBookings = await prisma.booking.findMany({
                        where: {
                            partner_id: partner.id,
                            status: { in: ['PARTNER_ACCEPTED', 'IN_PROGRESS'] },
                        },
                    });

                    // Emit location to customers tracking this partner
                    activeBookings.forEach((booking) => {
                        customerNamespace.to(`booking:${booking.id}`).emit('partner:location_update', {
                            bookingId: booking.id,
                            location: {
                                latitude: data.latitude,
                                longitude: data.longitude,
                            },
                            timestamp: new Date(),
                        });
                    });
                }
            } catch (error) {
                logger.error('Error updating location:', error);
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
    io.of('/partner').to(`user:${partnerId}`).emit('booking:new_request', {
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        service: booking.items[0]?.service?.name,
        scheduledAt: booking.scheduled_date,
        address: booking.service_address,
        amount: booking.total_amount,
    });
};
