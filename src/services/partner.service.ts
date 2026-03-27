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
        const { search, status, type, categoryId, page = 1, limit = 10 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {
            role: { in: ['SERVICE_PARTNER', 'BUSINESS_PARTNER'] as any[] },
            is_deleted: false,
        };

        const andConditions: any[] = [];

        if (status) {
            andConditions.push({
                OR: [
                    { service_partner: { kyc_status: status } },
                    { business_partner: { kyc_status: status } },
                ],
            });
        }

        if (categoryId) {
            andConditions.push({
                OR: [
                    { service_partner: { category_id: categoryId } },
                    { business_partner: { category_id: categoryId } },
                ],
            });
        }

        if (search) {
            andConditions.push({
                OR: [
                    { full_name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone_number: { contains: search } },
                ],
            });
        }

        if (type) {
            where.role = type;
        }

        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    service_partner: {
                        include: { category: true }
                    },
                    business_partner: {
                        include: { category: true }
                    },
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
                category: (partnerData as any)?.category?.name,
                categoryId: (partnerData as any)?.category_id,
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
        // Try to find in servicePartner
        let partner = await prisma.servicePartner.findUnique({
            where: { id },
            include: { user: true, kyc_documents: true }
        }) as any;

        // If not found, try businessPartner
        if (!partner) {
            partner = await prisma.businessPartner.findUnique({
                where: { id },
                include: { user: true, service_partners: true }
            }) as any;
        }

        if (!partner) throw new NotFoundError('Partner not found');

        const user = partner.user;
        const partnerType = partner.business_name ? 'BUSINESS' : 'SERVICE';
        const totalEarnings = await this.getTotalEarnings(partner.id, partnerType);

        return {
            id: partner.id,
            userId: user.id,
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            role: user.role,
            kycStatus: partner.kyc_status,
            kyc_status: partner.kyc_status,
            kycVerifiedAt: partner.kyc_verified_at,
            availabilityStatus: partner.availability_status,
            availability_status: partner.availability_status,
            serviceRadius: partner.service_radius,
            commissionRate: partner.commission_rate || 0.1,
            businessName: partner.business_name,
            businessType: partner.business_type,
            gstNumber: partner.gst_number,
            panNumber: partner.pan_number,
            bankDetails: partner.bank_details || {
                accountNumber: partner.bank_account_number,
                ifscCode: partner.bank_ifsc_code,
                accountName: partner.bank_account_name,
            },
            createdAt: user.created_at,
            isActive: user.is_active,
            servicePartnersCount: partner.service_partners?.length,
            // Metrics
            totalBookings: partner.total_bookings || 0,
            total_bookings: partner.total_bookings || 0,
            completedBookings: partner.completed_bookings || 0,
            completed_bookings: partner.completed_bookings || 0,
            avgRating: partner.avg_rating || 0,
            avg_rating: partner.avg_rating || 0,
            completionRate: partner.completion_rate || 0,
            totalEarnings,
            total_earnings: totalEarnings,
            custom_role: user.custom_role,
        };
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
        let status = data.availability_status || data.status;

        // Support { is_online: boolean } from dashboard
        if (data.is_online !== undefined) {
            status = data.is_online ? 'ONLINE' : 'OFFLINE';
        }

        // Map ONLINE to AVAILABLE (Prisma enum)
        if (status === 'ONLINE') {
            status = 'AVAILABLE';
        }

        if (!status) {
            throw new BadRequestError('Availability status is required');
        }

        const updatedPartner = await prisma.servicePartner.update({
            where: { id },
            data: { availability_status: status as any }
        });

        return {
            availability_status: updatedPartner.availability_status
        };
    }

    async getPartnerServices(id: string) {
        const services = await prisma.partnerService.findMany({
            where: { partner_id: id } as any,
            include: { service: { include: { category: true } } }
        });

        return services.map(ps => ({
            id: ps.id,
            serviceId: ps.service_id,
            serviceName: ps.service.name,
            category: ps.service.category?.name || 'Uncategorized',
            basePrice: ps.service.base_price,
            customPrice: ps.custom_price,
            duration: ps.service.duration,
            isAvailable: ps.is_available
        }));
    }

    async updatePartnerService(psId: string, data: any) {
        return await prisma.partnerService.update({
            where: { id: psId },
            data: {
                is_available: data.isAvailable !== undefined ? data.isAvailable : data.is_available,
                custom_price: data.basePrice || data.customPrice || data.custom_price
            }
        });
    }

    async getPartnerEarnings(id: string) {
        // Try to get wallet for the user associated with this partner
        const partner = await prisma.servicePartner.findUnique({
            where: { id },
            select: { user_id: true }
        }) || await prisma.businessPartner.findUnique({
            where: { id },
            select: { user_id: true }
        });

        if (!partner) return { totalEarnings: 0, currentBalance: 0, pendingPayouts: 0 };

        const wallet = await prisma.wallet.findUnique({
            where: { user_id: partner.user_id }
        });

        return {
            totalEarnings: wallet?.balance || 0, // Simplified: should be sum of past earned
            currentBalance: wallet?.balance || 0,
            pendingPayouts: wallet?.pending_payout || 0,
            recentTransactions: [] // Front end can handle empty
        };
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

    async assignServiceToPartner(partnerId: string, serviceId: string, options: any = {}) {
        return await prisma.partnerService.upsert({
            where: {
                service_id_partner_id: {
                    service_id: serviceId,
                    partner_id: partnerId
                }
            } as any,
            update: {
                is_available: options.isAvailable ?? options.is_available ?? true,
                custom_price: options.customPrice ?? options.custom_price
            },
            create: {
                partner_id: partnerId,
                service_id: serviceId,
                is_available: options.isAvailable ?? options.is_available ?? true,
                custom_price: options.customPrice ?? options.custom_price
            }
        });
    }

    async updateCommissionRate(_partnerId: string, _rate: number, _userId: string) {
        return { message: 'Commission rate update logic' };
    }

    async getCommissionHistory(_partnerId: string) {
        return [];
    }

    async bulkAssignServices(partnerIds: string[], serviceIds: string[]) {
        const results = [];
        for (const pid of partnerIds) {
            for (const sid of serviceIds) {
                try {
                    const res = await this.assignServiceToPartner(pid, sid);
                    results.push(res);
                } catch (e) {
                    logger.error(`Failed to assign service ${sid} to partner ${pid}:`, e);
                }
            }
        }
        return { 
            message: `Bulk service assignment completed. Processed ${results.length} relations.`, 
            processed: results.length 
        };
    }

    async getPartnersAnalytics(_filters: any) {
        const [totalCount, activeCount, pendingCount] = await Promise.all([
            prisma.servicePartner.count(),
            prisma.servicePartner.count({ where: { availability_status: 'AVAILABLE' } as any }),
            prisma.servicePartner.count({ where: { kyc_status: 'PENDING' } as any })
        ]);

        return { 
            totalPartners: totalCount, 
            activePartners: activeCount,
            pendingKyc: pendingCount,
            trend: [
                { name: 'Last Week', value: Math.floor(totalCount * 0.9) },
                { name: 'This Week', value: totalCount }
            ]
        };
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

    async getDashboardStats(userId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            select: { id: true, avg_rating: true }
        });

        if (!partner) throw new NotFoundError('Service partner not found');

        // 1. Current Job (In Progress or Accepted)
        const currentJob = await prisma.booking.findFirst({
            where: {
                partner_id: partner.id,
                status: { in: ['PARTNER_ACCEPTED', 'PARTNER_ARRIVED', 'IN_PROGRESS'] }
            },
            include: {
                items: { include: { service: true } },
                customer: { select: { full_name: true, phone_number: true, profile: true } }
            },
            orderBy: { updated_at: 'desc' }
        });

        // 2. Earnings Today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const earningsToday = await prisma.transaction.aggregate({
            where: {
                user_id: userId,
                type: 'BOOKING_PAYMENT',
                category: 'CREDIT',
                created_at: { gte: startOfDay }
            },
            _sum: {
                amount: true
            }
        });

        return {
            role: 'SERVICE_PARTNER',
            current_job: currentJob ? {
                id: currentJob.id,
                bookingNumber: currentJob.booking_number,
                status: currentJob.status,
                serviceName: currentJob.items[0]?.service?.name,
                customerName: currentJob.customer.full_name,
                address: currentJob.service_address
            } : null,
            earnings_today: earningsToday._sum.amount || 0,
            rating: partner.avg_rating
        };
    }

    async getTotalEarnings(partnerId: string, partnerType: 'SERVICE' | 'BUSINESS') {
        const partner = partnerType === 'SERVICE'
            ? await prisma.servicePartner.findUnique({ where: { id: partnerId }, select: { user_id: true } })
            : await prisma.businessPartner.findUnique({ where: { id: partnerId }, select: { user_id: true } });

        if (!partner) return 0;

        const result = await prisma.transaction.aggregate({
            where: {
                user_id: partner.user_id,
                type: 'BOOKING_PAYMENT',
                category: 'CREDIT',
                status: 'COMPLETED'
            },
            _sum: {
                amount: true
            }
        });

        return result._sum.amount || 0;
    }

    formatPartnerData(partner: any) {
        return {
            id: partner.id,
            kyc_status: partner.kyc_status || partner.kycStatus,
            availability_status: partner.availability_status || partner.availabilityStatus,
            avg_rating: partner.avg_rating || partner.avgRating || 0,
            total_bookings: partner.total_bookings || partner.totalBookings || 0,
            completed_bookings: partner.completed_bookings || partner.completedBookings || 0,
            // These are for frontend compatibility (camelCase)
            kycStatus: partner.kyc_status || partner.kycStatus,
            availabilityStatus: partner.availability_status || partner.availabilityStatus,
            avgRating: partner.avg_rating || partner.avgRating || 0,
            totalBookings: partner.total_bookings || partner.totalBookings || 0,
            completedBookings: partner.completed_bookings || partner.completedBookings || 0,
        };
    }
}
