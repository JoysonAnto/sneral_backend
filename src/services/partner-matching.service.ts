import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { ServicePartner } from '@prisma/client';

interface PartnerWithDistance extends ServicePartner {
    distance: number; // Made required instead of optional
    user: {
        id: string;
        full_name: string;
        phone_number: string | null;
    };
}

export class PartnerMatchingService {
    /**
     * Calculate distance between two points using Haversine formula
     * Returns distance in kilometers
     */
    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * Find available partners for a booking based on:
     * 1. Service category match
     * 2. Location proximity (within service radius)
     * 3. Availability status (AVAILABLE)
     * 4. KYC approval status
     */
    async findAvailablePartners(bookingId: string): Promise<PartnerWithDistance[]> {
        logger.info(`Finding available partners for booking: ${bookingId}`);

        // Get booking details with service and category
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
            },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (!booking.items || booking.items.length === 0) {
            throw new BadRequestError('Booking has no service items');
        }

        const serviceItem = booking.items[0];
        const categoryId = serviceItem.service.category_id;
        const bookingLat = booking.service_latitude;
        const bookingLon = booking.service_longitude;

        if (!bookingLat || !bookingLon) {
            throw new BadRequestError('Booking location not specified');
        }

        logger.info(`Searching for partners in category: ${serviceItem.service.category.name}`);
        logger.info(`Booking location: ${bookingLat}, ${bookingLon}`);

        // Find all available partners in the matching category who don't have active bookings
        const partners = await prisma.servicePartner.findMany({
            where: {
                category_id: categoryId,
                availability_status: 'AVAILABLE',
                kyc_status: 'APPROVED',
                bookings: {
                    none: {
                        status: {
                            in: ['PARTNER_ASSIGNED', 'PARTNER_ACCEPTED', 'ARRIVED', 'IN_PROGRESS']
                        }
                    }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        phone_number: true,
                    },
                },
            },
        });

        logger.info(`Found ${partners.length} potential partners`);

        // Calculate distance for each partner and filter by service radius
        const partnersWithDistance: PartnerWithDistance[] = partners
            .map((partner) => {
                if (!partner.current_latitude || !partner.current_longitude) {
                    return null;
                }

                const distance = this.calculateDistance(
                    bookingLat,
                    bookingLon,
                    partner.current_latitude,
                    partner.current_longitude
                );

                return {
                    ...partner,
                    distance,
                };
            })
            .filter((p): p is PartnerWithDistance =>
                p !== null &&
                p.distance !== undefined &&
                p.distance <= (p.service_radius || 10)
            )
            .sort((a, b) => (a.distance || 0) - (b.distance || 0)); // Sort by distance

        logger.info(`${partnersWithDistance.length} partners within service radius`);
        partnersWithDistance.forEach(p => {
            logger.info(`  - ${p.user.full_name}: ${p.distance?.toFixed(2)}km away`);
        });

        return partnersWithDistance;
    }

    /**
     * Check if a booking can still be accepted by a partner
     * Returns true if booking is available, false otherwise
     */
    async isBookingAvailable(bookingId: string): Promise<boolean> {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            select: { status: true, partner_id: true },
        });

        if (!booking) {
            return false;
        }

        // Booking is available if it's in SEARCHING_PARTNER or PENDING status
        // and no partner is assigned yet
        return (
            (booking.status === 'SEARCHING_PARTNER' || booking.status === 'PENDING') &&
            !booking.partner_id
        );
    }

    /**
     * Record partner rejection for tracking
     */
    async recordRejection(
        bookingId: string,
        partnerId: string,
        reason?: string
    ): Promise<void> {
        try {
            // Log rejection (could be stored in a separate table if needed)
            logger.info(`Partner ${partnerId} rejected booking ${bookingId}. Reason: ${reason || 'Not specified'}`);

            // Create notification record (log rejection)
            await prisma.notification.create({
                data: {
                    user_id: partnerId,
                    type: 'GENERAL',
                    title: 'Booking Rejected',
                    message: `You rejected booking. ${reason ? `Reason: ${reason}` : ''}`,
                },
            });
        } catch (error) {
            logger.error('Failed to record rejection:', error);
        }
    }

    /**
     * Get partners who have already been notified about a booking
     * Note: This is a simplified version without metadata filtering
     */
    async getNotifiedPartners(_bookingId: string): Promise<string[]> {
        // For now, return empty array since metadata field doesn't exist in schema
        // In production, you'd want to add a separate booking_notifications table
        return [];
    }
}
