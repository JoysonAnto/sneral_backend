import prisma from '../config/database';
import { getIO } from '../socket/socket.server';

export class LocationTrackingService {
    /**
     * Record partner location (when online)
     */
    async recordPartnerLocation(
        partnerId: string,
        latitude: number,
        longitude: number,
        accuracy?: number,
        bookingId?: string
    ) {
        try {
            // Update partner's current location
            await prisma.servicePartner.update({
                where: { id: partnerId },
                data: {
                    current_latitude: latitude,
                    current_longitude: longitude,
                    last_location_update: new Date(),
                },
            });

            // Store in location history
            const locationRecord = await prisma.partnerLocationHistory.create({
                data: {
                    partner_id: partnerId,
                    latitude,
                    longitude,
                    accuracy,
                    booking_id: bookingId,
                    is_online: true,
                },
            });

            // Broadcast location to admin and customer (if booking is active)
            const io = getIO();

            // Broadcast to admin
            io.of('/admin').to('admin').emit('partner:location_update', {
                partnerId,
                latitude,
                longitude,
                accuracy,
                timestamp: locationRecord.recorded_at,
                bookingId,
            });

            // If there's an active booking, broadcast to customer
            if (bookingId) {
                const booking = await prisma.booking.findUnique({
                    where: { id: bookingId },
                    select: { customer_id: true },
                });

                if (booking) {
                    io.of('/customer').to(`customer:${booking.customer_id}`).emit('partner:location_update', {
                        partnerId,
                        latitude,
                        longitude,
                        accuracy,
                        timestamp: locationRecord.recorded_at,
                        bookingId,
                    });
                }
            }

            return locationRecord;
        } catch (error) {
            console.error('❌ Error recording partner location:', error);
            throw error;
        }
    }

    /**
     * Get partner's location history
     */
    async getPartnerLocationHistory(
        partnerId: string,
        startDate?: Date,
        endDate?: Date,
        limit: number = 100
    ) {
        const where: any = { partner_id: partnerId };

        if (startDate || endDate) {
            where.recorded_at = {};
            if (startDate) where.recorded_at.gte = startDate;
            if (endDate) where.recorded_at.lte = endDate;
        }

        return await prisma.partnerLocationHistory.findMany({
            where,
            orderBy: { recorded_at: 'desc' },
            take: limit,
            include: {
                booking: {
                    select: {
                        id: true,
                        booking_number: true,
                        status: true,
                        customer: {
                            select: {
                                full_name: true,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Get location history for a specific booking
     */
    async getBookingLocationHistory(bookingId: string) {
        return await prisma.partnerLocationHistory.findMany({
            where: { booking_id: bookingId },
            orderBy: { recorded_at: 'asc' },
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
    }

    /**
     * Get all online partners with their current locations
     */
    async getAllOnlinePartners() {
        return await prisma.servicePartner.findMany({
            where: {
                availability_status: 'AVAILABLE',
                current_latitude: { not: null },
                current_longitude: { not: null },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        phone_number: true,
                    },
                },
                bookings: {
                    where: {
                        status: {
                            in: ['PARTNER_ACCEPTED', 'ARRIVED', 'IN_PROGRESS'],
                        },
                    },
                    select: {
                        id: true,
                        booking_number: true,
                        status: true,
                        service_address: true,
                        service_latitude: true,
                        service_longitude: true,
                        customer: {
                            select: {
                                full_name: true,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Log booking activity (for admin monitoring)
     */
    async logBookingActivity(
        bookingId: string,
        actorType: 'PARTNER' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM',
        actorId: string,
        action: string,
        previousStatus?: string,
        newStatus?: string,
        locationLat?: number,
        locationLng?: number,
        details?: any,
        ipAddress?: string,
        userAgent?: string
    ) {
        try {
            const log = await prisma.bookingActivityLog.create({
                data: {
                    booking_id: bookingId,
                    actor_type: actorType,
                    actor_id: actorId,
                    action,
                    previous_status: previousStatus as any,
                    new_status: newStatus as any,
                    location_lat: locationLat,
                    location_lng: locationLng,
                    details,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                },
            });

            // Broadcast to admin dashboard
            const io = getIO();
            io.to('admin').emit('booking:activity', {
                bookingId,
                action,
                actorType,
                timestamp: log.created_at,
                details: {
                    previousStatus,
                    newStatus,
                    location: locationLat && locationLng ? { lat: locationLat, lng: locationLng } : null,
                },
            });

            return log;
        } catch (error) {
            console.error('❌ Error logging booking activity:', error);
            throw error;
        }
    }

    /**
     * Get all activity logs for a booking
     */
    async getBookingActivityLogs(bookingId: string) {
        return await prisma.bookingActivityLog.findMany({
            where: { booking_id: bookingId },
            orderBy: { created_at: 'asc' },
        });
    }

    /**
     * Get activity logs for admin dashboard
     */
    async getAllActivityLogs(filters: {
        startDate?: Date;
        endDate?: Date;
        actorType?: string;
        action?: string;
        limit?: number;
        page?: number;
    }) {
        const { startDate, endDate, actorType, action, limit = 50, page = 1 } = filters;

        const where: any = {};

        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at.gte = startDate;
            if (endDate) where.created_at.lte = endDate;
        }

        if (actorType) where.actor_type = actorType;
        if (action) where.action = action;

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            prisma.bookingActivityLog.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
                include: {
                    booking: {
                        select: {
                            id: true,
                            booking_number: true,
                            customer: {
                                select: {
                                    full_name: true,
                                },
                            },
                            partner: {
                                include: {
                                    user: {
                                        select: {
                                            full_name: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.bookingActivityLog.count({ where }),
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Mark partner as offline and stop tracking
     */
    async markPartnerOffline(partnerId: string) {
        await prisma.servicePartner.update({
            where: { id: partnerId },
            data: {
                availability_status: 'OFFLINE',
            },
        });

        // Update last location record
        const lastLocation = await prisma.partnerLocationHistory.findFirst({
            where: { partner_id: partnerId },
            orderBy: { recorded_at: 'desc' },
        });

        if (lastLocation) {
            await prisma.partnerLocationHistory.update({
                where: { id: lastLocation.id },
                data: { is_online: false },
            });
        }
    }
}
