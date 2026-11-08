import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { getIO } from '../socket/socket.server';
import { SpatialHexHelper } from '../utils/spatial-hex.helper';

export interface PartnerCandidate {
    id: string;
    userId: string;
    fullName: string;
    phoneNumber: string | null;
    distanceKm: number;
    estimatedEtaMinutes: number;
    rating: number;
    availabilityStatus: string;
    wentOfflineAt?: Date | null;
    wentOfflineMinutesAgo?: number | null;
    currentLatitude: number | null;
    currentLongitude: number | null;
    // Fatigue & Workload Guard
    todayCompletedJobs: number;
    todayWorkedHours: number;
    fatigueLevel: 'LOW' | 'MODERATE' | 'HIGH';
    activeJobId?: string | null;
    activeJobServiceName?: string | null;
    activeJobRemainingMinutes?: number | null;
}

export class ManualDispatchService {
    /**
     * Get candidate partners for manual dispatch partitioned into 3 pools:
     * 1. Available Online Partners
     * 2. Recently Offline Partners (Wake-up Candidates)
     * 3. Busy Partners Ending Soon (Next Job Candidates)
     */
    async getDispatchCandidates(bookingId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: { include: { service: { include: { category: true } } } },
                customer: { select: { id: true, full_name: true, phone_number: true } }
            }
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        const categoryId = booking.items[0]?.service?.category_id;
        const bLat = booking.service_latitude;
        const bLng = booking.service_longitude;

        if (!bLat || !bLng) {
            throw new BadRequestError('Booking has no valid geographic coordinates');
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Fetch all partners matching skill category
        const allPartners = await prisma.servicePartner.findMany({
            where: {
                OR: [
                    { category_id: categoryId },
                    { skill_categories: { has: categoryId } },
                    { services: { some: { service: { category_id: categoryId }, is_available: true } } }
                ],
                partner_status: { notIn: ['SUSPENDED', 'INACTIVE', 'REJECTED'] as any },
                is_on_hold: false,
                is_blacklisted: false,
                user: { is_active: true }
            },
            include: {
                user: { select: { id: true, full_name: true, phone_number: true } },
                bookings: {
                    where: {
                        OR: [
                            { status: { in: ['COMPLETED', 'RATED'] }, completed_at: { gte: startOfDay } },
                            { status: { in: ['IN_PROGRESS', 'PARTNER_ARRIVED'] } }
                        ]
                    },
                    include: { items: { include: { service: true } } }
                }
            }
        });

        const onlinePartners: PartnerCandidate[] = [];
        const recentlyOfflinePartners: PartnerCandidate[] = [];
        const busyEndingSoonPartners: PartnerCandidate[] = [];

        const now = Date.now();
        const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

        for (const p of allPartners) {
            const pLat = p.current_latitude;
            const pLng = p.current_longitude;

            const distance = (pLat && pLng) 
                ? SpatialHexHelper.haversineDistance(bLat, bLng, pLat, pLng)
                : 999;

            // Compute today's completed jobs & duration hours
            const completedToday = p.bookings.filter(b => ['COMPLETED', 'RATED'].includes(b.status));
            const todayCompletedJobs = completedToday.length;
            const todayWorkedMinutes = completedToday.reduce((sum, b) => sum + (b.actual_duration || b.estimated_duration || 60), 0);
            const todayWorkedHours = Math.round((todayWorkedMinutes / 60) * 10) / 10;

            let fatigueLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
            if (todayCompletedJobs >= 7 || todayWorkedHours >= 8.0) {
                fatigueLevel = 'HIGH';
            } else if (todayCompletedJobs >= 4 || todayWorkedHours >= 4.0) {
                fatigueLevel = 'MODERATE';
            }

            const estimatedEtaMinutes = Math.max(5, Math.round((distance / 20) * 60)); // ~20km/h city speed

            const candidate: PartnerCandidate = {
                id: p.id,
                userId: p.user_id,
                fullName: p.user.full_name,
                phoneNumber: p.user.phone_number,
                distanceKm: Math.round(distance * 10) / 10,
                estimatedEtaMinutes,
                rating: p.avg_rating || 5.0,
                availabilityStatus: p.availability_status,
                wentOfflineAt: p.went_offline_at,
                wentOfflineMinutesAgo: p.went_offline_at ? Math.round((now - p.went_offline_at.getTime()) / 60000) : null,
                currentLatitude: pLat,
                currentLongitude: pLng,
                todayCompletedJobs,
                todayWorkedHours,
                fatigueLevel,
            };

            // POOL 1: AVAILABLE ONLINE
            if (p.availability_status === 'AVAILABLE' && distance <= 15) {
                onlinePartners.push(candidate);
            }
            // POOL 2: RECENTLY OFFLINE (offline in last 2 hours or last location within 15 km)
            else if (p.availability_status === 'OFFLINE' && distance <= 15) {
                const wasRecent = p.went_offline_at ? p.went_offline_at >= twoHoursAgo : true;
                if (wasRecent) {
                    recentlyOfflinePartners.push(candidate);
                }
            }
            // POOL 3: BUSY ENDING SOON (active job within 12 km nearing completion)
            else if (p.availability_status === 'BUSY' && distance <= 12) {
                const activeJob = p.bookings.find(b => ['IN_PROGRESS', 'PARTNER_ARRIVED'].includes(b.status));
                if (activeJob) {
                    const startedTime = activeJob.started_at ? activeJob.started_at.getTime() : activeJob.created_at.getTime();
                    const elapsedMins = (now - startedTime) / 60000;
                    const estDuration = activeJob.estimated_duration || 60;
                    const percentComplete = (elapsedMins / estDuration) * 100;

                    // If at least 65% complete or < 20 mins remaining
                    if (percentComplete >= 65 || (estDuration - elapsedMins) <= 20) {
                        candidate.activeJobId = activeJob.id;
                        candidate.activeJobServiceName = activeJob.items[0]?.service?.name || 'In-Progress Service';
                        candidate.activeJobRemainingMinutes = Math.max(0, Math.round(estDuration - elapsedMins));
                        busyEndingSoonPartners.push(candidate);
                    }
                }
            }
        }

        // Sort each pool by distance asc
        onlinePartners.sort((a, b) => a.distanceKm - b.distanceKm);
        recentlyOfflinePartners.sort((a, b) => a.distanceKm - b.distanceKm);
        busyEndingSoonPartners.sort((a, b) => a.distanceKm - b.distanceKm);

        return {
            booking: {
                id: booking.id,
                bookingNumber: booking.booking_number,
                serviceName: booking.items[0]?.service?.name || 'Home Service',
                customerName: booking.customer.full_name,
                customerPhone: booking.customer.phone_number,
                serviceAddress: booking.service_address,
                serviceLatitude: bLat,
                serviceLongitude: bLng,
                totalAmount: booking.total_amount,
                status: booking.status,
                createdAt: booking.created_at,
            },
            pools: {
                online: onlinePartners,
                recentlyOffline: recentlyOfflinePartners,
                busyEndingSoon: busyEndingSoonPartners,
            },
            summary: {
                totalOnline: onlinePartners.length,
                totalOfflineNearby: recentlyOfflinePartners.length,
                totalBusyEndingSoon: busyEndingSoonPartners.length,
            }
        };
    }

    /**
     * Send priority WhatsApp/SMS wake-up alert to an offline partner
     */
    async sendWakeUpAlert(bookingId: string, partnerId: string) {
        const [booking, partner] = await Promise.all([
            prisma.booking.findUnique({
                where: { id: bookingId },
                include: { items: { include: { service: true } } }
            }),
            prisma.servicePartner.findUnique({
                where: { id: partnerId },
                include: { user: true }
            })
        ]);

        if (!booking || !partner) {
            throw new NotFoundError('Booking or Partner record not found');
        }

        const serviceName = booking.items[0]?.service?.name || 'Home Service';
        const partnerName = partner.user.full_name;
        const phone = partner.user.phone_number;
        const amount = booking.total_amount;
        const bookingLink = `https://snearal.com/partner/jobs/${booking.id}`;

        const alertMessage = `Hi ${partnerName}! A customer near you in ${booking.service_address.slice(0, 30)}... needs ${serviceName} right now (Earnings: ₹${amount}). Tap here to go ONLINE and accept: ${bookingLink}`;

        logger.info(`[WAKE_UP_ALERT] Sent to partner ${partner.id} (${phone}): ${alertMessage}`);

        // Broadcast socket alert to partner room if connected in background
        try {
            const io = getIO();
            io.of('/partner').to(partner.user_id).emit('partner:wake_up_alert', {
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                serviceName,
                amount,
                message: alertMessage,
            });
        } catch (e) {
            logger.warn('Socket wake up broadcast failed:', e);
        }

        return {
            success: true,
            partnerName,
            phoneNumber: phone,
            alertMessage,
            sentAt: new Date(),
        };
    }

    /**
     * Force partner to AVAILABLE and immediately assign booking
     */
    async forceOnlineAndAssign(bookingId: string, partnerId: string, adminUserId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
            include: { user: true }
        });

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        // Toggle partner to AVAILABLE
        await prisma.servicePartner.update({
            where: { id: partnerId },
            data: {
                availability_status: 'AVAILABLE',
                went_offline_at: null,
                last_location_update: new Date(),
            }
        });

        // Use booking service to assign partner
        const { BookingService } = await import('./booking.service');
        const bookingService = new BookingService();
        return await bookingService.assignPartner(bookingId, partnerId, adminUserId);
    }
}

export const manualDispatchService = new ManualDispatchService();

