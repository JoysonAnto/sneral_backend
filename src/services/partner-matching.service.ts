import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { ServicePartner } from '@prisma/client';
import { SpatialHexHelper } from '../utils/spatial-hex.helper';

interface PartnerWithDistance extends ServicePartner {
    distance: number;
    hexDistance: number;
    isHeadingHome: boolean;
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
        return SpatialHexHelper.haversineDistance(lat1, lon1, lat2, lon2);
    }

    /**
     * Find available partners for a booking based on:
     * 1. Multi-skill category competence (primary category, skill_categories, or catalog service)
     * 2. Hexagonal grid spatial indexing and location proximity
     * 3. End-of-Day destination mode ("Go to Home Location")
     * 4. Availability & KYC status
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

        // Calculate booking hexagonal grid cell and 2-ring neighborhood
        const bookingHex = SpatialHexHelper.latLngToHex(bookingLat, bookingLon);
        const bookingHexNeighbors = SpatialHexHelper.getHexNeighbors(bookingHex, 2);

        logger.info(`Searching for partners in category: ${serviceItem.service.category.name} (${categoryId})`);
        logger.info(`Booking location: ${bookingLat}, ${bookingLon} [Hex Index: ${bookingHex}]`);

        // Find all available partners matching primary category OR multiple skill categories OR active service competencies
        const partners = await prisma.servicePartner.findMany({
            where: {
                OR: [
                    { category_id: categoryId },
                    { skill_categories: { has: categoryId } },
                    { services: { some: { service: { category_id: categoryId }, is_available: true } } }
                ],
                availability_status: 'AVAILABLE',
                partner_status: { notIn: ['SUSPENDED', 'INACTIVE', 'REJECTED'] as any },
                kyc_status: 'APPROVED',
                is_on_hold: false,
                is_blacklisted: false,
                user: {
                    is_active: true
                },
                bookings: {
                    none: {
                        status: {
                            in: ['PARTNER_ASSIGNED', 'PARTNER_ACCEPTED', 'PARTNER_ARRIVED', 'IN_PROGRESS']
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

        logger.info(`Found ${partners.length} multi-skill competent partners in DB for category: ${categoryId}`);

        // Calculate distance, hex matching, and Destination Mode ("Go to Home Location")
        const partnersWithDistance: PartnerWithDistance[] = partners
            .map((partner) => {
                const partnerLat = partner.current_latitude;
                const partnerLon = partner.current_longitude;

                const distance = (partnerLat && partnerLon) 
                    ? this.calculateDistance(bookingLat, bookingLon, partnerLat, partnerLon)
                    : 999999;

                // Partner's current hex cell
                const partnerHex = partner.h3_index || (partnerLat && partnerLon ? SpatialHexHelper.latLngToHex(partnerLat, partnerLon) : null);
                const isInHexNeighborDisk = partnerHex ? bookingHexNeighbors.includes(partnerHex) : false;

                // Check "Go to Home Location" destination mode
                let isHeadingHome = true;
                if (partner.destination_mode_active && partner.home_latitude && partner.home_longitude && partnerLat && partnerLon) {
                    isHeadingHome = SpatialHexHelper.isTowardsHome(
                        partnerLat,
                        partnerLon,
                        bookingLat,
                        bookingLon,
                        partner.home_latitude,
                        partner.home_longitude
                    );
                }

                return {
                    ...partner,
                    distance,
                    hexDistance: isInHexNeighborDisk ? 0 : 1,
                    isHeadingHome,
                };
            })
            .filter((p): p is PartnerWithDistance => {
                if (!p) return false;
                
                // If partner is in Destination Mode, exclude orders that take them further away from home
                if (p.destination_mode_active && !p.isHeadingHome) {
                    logger.info(`  ❌ Partner ${p.user.full_name} skipped: Order direction does not match residential Home route`);
                    return false;
                }

                if (process.env.NODE_ENV === 'development') return true;
                return p.distance <= (p.service_radius || 15);
            })
            .sort((a, b) => {
                // Prioritize destination mode partners whose home route matches
                if (a.destination_mode_active && !b.destination_mode_active) return -1;
                if (!a.destination_mode_active && b.destination_mode_active) return 1;

                // Then sort by distance
                return (a.distance || 0) - (b.distance || 0);
            });

        logger.info(`${partnersWithDistance.length} partners selected for dispatching`);
        partnersWithDistance.forEach(p => {
            logger.info(`  - ${p.user.full_name}: ${p.distance?.toFixed(2)}km away (Destination Mode: ${p.destination_mode_active ? 'ON' : 'OFF'})`);
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
