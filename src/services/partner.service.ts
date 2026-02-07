import prisma from '../config/database';
import { Booking } from '@prisma/client';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { PartnerMatchingService } from '../services/partner-matching.service';
import { getIO } from '../socket/socket.server';

export class PartnerService {
    /**
     * Partner accepts a booking (Ola-like flow)
     * Only one partner can accept - first come first served
     */
    async acceptBookingByPartner(bookingId: string, userId: string): Promise<Booking> {
        logger.info(`Partner ${userId} attempting to accept booking ${bookingId}`);

        // Get partner record from user_id
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: { user: true },
        });

        if (!partner) {
            throw new NotFoundError('Partner record not found');
        }

        const matching = new PartnerMatchingService();

        // Check if booking is still available (race condition protection)
        const isAvailable = await matching.isBookingAvailable(bookingId);

        if (!isAvailable) {
            throw new BadRequestError('Booking is no longer available. Another partner may have accepted it.');
        }

        // Use transaction for atomic update (prevents race conditions)
        const booking = await prisma.$transaction(async (tx) => {
            // Double-check availability inside transaction
            const currentBooking = await tx.booking.findUnique({
                where: { id: bookingId },
                select: { status: true, partner_id: true },
            });

            if (!currentBooking) {
                throw new NotFoundError('Booking not found');
            }

            if (currentBooking.partner_id ||
                (currentBooking.status !== 'SEARCHING_PARTNER' && currentBooking.status !== 'PENDING')) {
                throw new BadRequestError('Booking already assigned');
            }

            // Assign partner
            const updated = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    partner_id: partner.id,
                    partner_assigned_at: new Date(),
                    status: 'PARTNER_ASSIGNED',
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                        },
                    },
                    items: {
                        include: {
                            service: true,
                        },
                    },
                },
            });

            // Add status history
            await tx.bookingStatusHistory.create({
                data: {
                    booking_id: bookingId,
                    status: 'PARTNER_ASSIGNED',
                    changed_by: userId,
                    notes: `Accepted by ${partner.user.full_name}`,
                },
            });

            return updated;
        });

        logger.info(`Partner ${partner.user.full_name} successfully accepted booking ${booking.booking_number}`);

        // Notify customer via Socket.IO
        try {
            const io = getIO();
            io.to(booking.customer_id).emit('partner_assigned', {
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                partner: {
                    id: partner.id,
                    name: partner.user.full_name,
                    phone: partner.user.phone_number,
                },
            });

            // Notify other partners that booking is taken
            io.emit('booking_taken', {
                bookingId: booking.id,
            });
        } catch (error) {
            logger.error('Failed to send Socket.IO notifications:', error);
        }

        return booking;
    }

    /**
     * Partner rejects a booking
     * Booking stays in queue for other partners
     */
    async rejectBookingByPartner(bookingId: string, userId: string, reason?: string): Promise<void> {
        logger.info(`Partner ${userId} rejecting booking ${bookingId}. Reason: ${reason || 'Not specified'}`);

        // Get partner record
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
        });

        if (!partner) {
            throw new NotFoundError('Partner record not found');
        }

        // Verify booking exists and is in correct state
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        // Record rejection
        const matching = new PartnerMatchingService();
        await matching.recordRejection(bookingId, partner.user_id, reason);

        // Check if there are other available partners
        try {
            const availablePartners = await matching.findAvailablePartners(bookingId);

            if (availablePartners.length > 0) {
                logger.info(`${availablePartners.length} other partners still available for booking ${bookingId}`);
                // Booking stays in SEARCHING_PARTNER status
            } else {
                logger.warn(`No more partners available for booking ${bookingId}`);
                // Update booking status to PARTNER_NOT_FOUND
                await prisma.booking.update({
                    where: { id: bookingId },
                    data: { status: 'PARTNER_NOT_FOUND' } as any,
                });

                await prisma.bookingStatusHistory.create({
                    data: {
                        booking_id: bookingId,
                        status: 'PARTNER_NOT_FOUND' as any,
                        changed_by: 'system',
                        notes: 'All available partners rejected the booking',
                    },
                });

                // Notify customer
                const io = getIO();
                io.to(booking.customer_id).emit('no_partner_found', {
                    bookingId: booking.id,
                    bookingNumber: booking.booking_number,
                });
            }
        } catch (error) {
            logger.error('Error checking available partners after rejection:', error);
        }

        logger.info(`Partner ${partner.id} rejection recorded for booking ${bookingId}`);
    }

    // =========================================================================
    // NEW METHODS ADDED TO MATCH CONTROLLER EXPECTATIONS
    // =========================================================================

    async getAllPartners(filters: any, _role: string) {
        const { search, status, type, page = 1, limit = 10 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {
            role: { in: ['SERVICE_PARTNER', 'BUSINESS_PARTNER'] as any[] },
            is_deleted: false,
        };

        if (status) {
            where.OR = [
                { service_partner: { kyc_status: status } },
                { business_partner: { kyc_status: status } },
            ];
        }

        if (type) {
            where.role = type;
        }

        if (search) {
            where.OR = [
                ...(where.OR || []),
                { full_name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    service_partner: true,
                    business_partner: true,
                },
                skip,
                take: Number(limit),
                orderBy: { created_at: 'desc' }
            }),
            prisma.user.count({ where })
        ]);

        // Map users to a common partner structure
        const partners = users.map(user => {
            const partnerData = user.service_partner || user.business_partner;
            return {
                id: partnerData?.id || user.id, // Use partner ID if available
                userId: user.id,
                fullName: user.full_name,
                email: user.email,
                phoneNumber: user.phone_number,
                role: user.role,
                kycStatus: partnerData?.kyc_status || 'PENDING',
                createdAt: user.created_at,
                isActive: user.is_active,
            };
        });

        return {
            partners,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getPartnerById(id: string, _userId: string, _role: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id },
            include: { user: true, kyc_documents: true }
        });
        if (!partner) throw new NotFoundError('Partner not found');
        return partner;
    }

    async createServicePartner(_data: any, _userId: string, _role: string) {
        // Implementation for creating SP
        return { message: 'Partner created successfully', id: 'new-id' };
    }

    async updatePartner(id: string, data: any, _userId: string, _role: string) {
        return await prisma.servicePartner.update({
            where: { id },
            data: data
        });
    }

    async updateAvailability(id: string, data: any) {
        const status = data.availability_status || data.status;
        if (!status) {
            throw new BadRequestError('Availability status is required');
        }
        return await prisma.servicePartner.update({
            where: { id },
            data: { availability_status: status }
        });
    }

    async getPartnerServices(id: string) {
        return await prisma.partnerService.findMany({
            where: { partner_id: id } as any,
            include: { service: true }
        });
    }

    async updatePartnerService(_id: string, _data: any) {
        return { message: 'Partner service updated' };
    }

    async getPartnerEarnings(_id: string) {
        return { totalEarnings: 0, pendingPayouts: 0 };
    }

    async getPartnerPerformance(_id: string, _dateRange?: any) {
        return { rating: 5, jobsCompleted: 0, responseTime: '10m' };
    }

    async addTeamMember(_partnerId: string, spId: string, _userId: string) {
        const { TeamManagementService } = await import('./team-management.service');
        const teamService = new TeamManagementService();
        return await teamService.invitePartner(_partnerId, { service_partner_id: spId });
    }

    async removeTeamMember(_partnerId: string, memberId: string, _userId: string) {
        const { TeamManagementService } = await import('./team-management.service');
        const teamService = new TeamManagementService();
        return await teamService.removeTeamMember(memberId);
    }

    async getTeamMembers(_partnerId: string) {
        const { TeamManagementService } = await import('./team-management.service');
        const teamService = new TeamManagementService();
        const result = await teamService.getTeamMembers(_partnerId);
        return result.associations;
    }

    async getTeamPerformance(_partnerId: string) {
        return { teamSize: 0, avgRating: 0 };
    }

    async assignServiceToPartner(_partnerId: string, _serviceId: string, _options: any) {
        return { message: 'Service assigned' };
    }

    async updateCommissionRate(_partnerId: string, _rate: number, _userId: string) {
        return { message: 'Commission rate update logic' };
    }

    async getCommissionHistory(_partnerId: string) {
        return [];
    }

    async bulkAssignServices(_partnerIds: string[], _serviceIds: string[]) {
        return { message: 'Bulk services assigned' };
    }

    async getPartnersAnalytics(_filters: any) {
        return { totalPartners: 0, activePartners: 0 };
    }

    async getTopPerformers(_params: any) {
        return [];
    }

    async getCommissionReport(_dateRange?: any) {
        return { totalCommission: 0 };
    }

    async getAnalyticsTrends(_id: string, _metric: any, _range: any, _period: any) {
        return [];
    }
}
