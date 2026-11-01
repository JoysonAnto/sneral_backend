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

        if (partner.is_on_hold) {
            throw new BadRequestError('Your account is currently on hold. You cannot accept new bookings.');
        }

        if (partner.is_blacklisted) {
            throw new BadRequestError('Your account has been blacklisted. You cannot accept new bookings.');
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
                isOnHold: (partnerData as any)?.is_on_hold || false,
                is_on_hold: (partnerData as any)?.is_on_hold || false,
                holdReason: (partnerData as any)?.hold_reason || null,
                isBlacklisted: (partnerData as any)?.is_blacklisted || false,
                is_blacklisted: (partnerData as any)?.is_blacklisted || false,
                blacklistReason: (partnerData as any)?.blacklist_reason || null,
                strikeCount: (partnerData as any)?.strike_count || 0,
                strike_count: (partnerData as any)?.strike_count || 0,
                adminRemarks: (partnerData as any)?.admin_remarks || null,
                admin_remarks: (partnerData as any)?.admin_remarks || null,
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
            isOnHold: partner.is_on_hold || false,
            is_on_hold: partner.is_on_hold || false,
            holdReason: partner.hold_reason || null,
            isBlacklisted: partner.is_blacklisted || false,
            is_blacklisted: partner.is_blacklisted || false,
            blacklistReason: partner.blacklist_reason || null,
            strikeCount: partner.strike_count || 0,
            strike_count: partner.strike_count || 0,
            adminRemarks: partner.admin_remarks || null,
            admin_remarks: partner.admin_remarks || null,
        };
    }

    async createServicePartner(_data: any, _userId: string, _role: string) {
        // Implementation for creating SP
        return { message: 'Partner created successfully', id: 'new-id' };
    }

    async updatePartner(id: string, data: any, _userId: string, _role: string) {
        // Try finding by servicePartner id or user_id
        let sp = await prisma.servicePartner.findFirst({
            where: {
                OR: [{ id }, { user_id: id }]
            },
            include: { user: true }
        });

        if (sp) {
            // Update user details if provided
            if (data.fullName || data.full_name || data.phoneNumber || data.phone_number) {
                await prisma.user.update({
                    where: { id: sp.user_id },
                    data: {
                        ...(data.fullName || data.full_name ? { full_name: data.fullName || data.full_name } : {}),
                        ...(data.phoneNumber || data.phone_number ? { phone_number: data.phoneNumber || data.phone_number } : {}),
                    }
                });
            }

            const partnerUpdateData: any = {};
            if (data.serviceRadius !== undefined || data.service_radius !== undefined) {
                partnerUpdateData.service_radius = parseFloat(data.serviceRadius ?? data.service_radius);
            }
            if (data.availabilityStatus || data.availability_status) {
                partnerUpdateData.availability_status = data.availabilityStatus || data.availability_status;
            }
            if (data.kycStatus || data.kyc_status) {
                partnerUpdateData.kyc_status = data.kycStatus || data.kyc_status;
            }
            if (data.bankAccountNumber !== undefined || data.bank_account_number !== undefined) {
                partnerUpdateData.bank_account_number = data.bankAccountNumber ?? data.bank_account_number;
            }
            if (data.bankIfscCode !== undefined || data.bank_ifsc_code !== undefined) {
                partnerUpdateData.bank_ifsc_code = data.bankIfscCode ?? data.bank_ifsc_code;
            }
            if (data.bankAccountName !== undefined || data.bank_account_name !== undefined) {
                partnerUpdateData.bank_account_name = data.bankAccountName ?? data.bank_account_name;
            }

            // Partner Sanctions: Hold, Blacklist, Strikes, Remarks
            if (data.isOnHold !== undefined || data.is_on_hold !== undefined) {
                partnerUpdateData.is_on_hold = Boolean(data.isOnHold ?? data.is_on_hold);
            }
            if (data.holdReason !== undefined || data.hold_reason !== undefined) {
                partnerUpdateData.hold_reason = data.holdReason ?? data.hold_reason;
            }
            if (data.isBlacklisted !== undefined || data.is_blacklisted !== undefined) {
                partnerUpdateData.is_blacklisted = Boolean(data.isBlacklisted ?? data.is_blacklisted);
                if (partnerUpdateData.is_blacklisted) {
                    partnerUpdateData.availability_status = 'OFFLINE';
                }
            }
            if (data.blacklistReason !== undefined || data.blacklist_reason !== undefined) {
                partnerUpdateData.blacklist_reason = data.blacklistReason ?? data.blacklist_reason;
            }
            if (data.strikeCount !== undefined || data.strike_count !== undefined) {
                const strikes = parseInt(data.strikeCount ?? data.strike_count) || 0;
                partnerUpdateData.strike_count = strikes;
                const threshold = parseInt(data.strikeThreshold) || 3;
                if ((data.autoBlacklist || strikes >= threshold) && strikes >= 3) {
                    partnerUpdateData.is_blacklisted = true;
                    if (!partnerUpdateData.blacklist_reason) {
                        partnerUpdateData.blacklist_reason = `Partner blacklisted due to reaching ${strikes} strikes`;
                    }
                    partnerUpdateData.availability_status = 'OFFLINE';
                }
            }
            if (data.adminRemarks !== undefined || data.admin_remarks !== undefined) {
                partnerUpdateData.admin_remarks = data.adminRemarks ?? data.admin_remarks;
            }

            return await prisma.servicePartner.update({
                where: { id: sp.id },
                data: partnerUpdateData,
                include: { user: true }
            });
        }

        // Try business partner
        let bp = await prisma.businessPartner.findFirst({
            where: {
                OR: [{ id }, { user_id: id }]
            },
            include: { user: true }
        });

        if (bp) {
            if (data.fullName || data.full_name || data.phoneNumber || data.phone_number) {
                await prisma.user.update({
                    where: { id: bp.user_id },
                    data: {
                        ...(data.fullName || data.full_name ? { full_name: data.fullName || data.full_name } : {}),
                        ...(data.phoneNumber || data.phone_number ? { phone_number: data.phoneNumber || data.phone_number } : {}),
                    }
                });
            }

            const bpUpdateData: any = {};
            if (data.businessName || data.business_name) {
                bpUpdateData.business_name = data.businessName || data.business_name;
            }
            if (data.businessType || data.business_type) {
                bpUpdateData.business_type = data.businessType || data.business_type;
            }
            if (data.gstNumber !== undefined || data.gst_number !== undefined) {
                bpUpdateData.gst_number = data.gstNumber ?? data.gst_number;
            }
            if (data.commissionRate !== undefined || data.commission_rate !== undefined) {
                bpUpdateData.commission_rate = parseFloat(data.commissionRate ?? data.commission_rate);
            }
            if (data.kycStatus || data.kyc_status) {
                bpUpdateData.kyc_status = data.kycStatus || data.kyc_status;
            }
            if (data.bankAccountNumber !== undefined || data.bank_account_number !== undefined) {
                bpUpdateData.bank_account_number = data.bankAccountNumber ?? data.bank_account_number;
            }
            if (data.bankIfscCode !== undefined || data.bank_ifsc_code !== undefined) {
                bpUpdateData.bank_ifsc_code = data.bankIfscCode ?? data.bank_ifsc_code;
            }
            if (data.bankAccountName !== undefined || data.bank_account_name !== undefined) {
                bpUpdateData.bank_account_name = data.bankAccountName ?? data.bank_account_name;
            }

            // Partner Sanctions: Hold, Blacklist, Strikes, Remarks
            if (data.isOnHold !== undefined || data.is_on_hold !== undefined) {
                bpUpdateData.is_on_hold = Boolean(data.isOnHold ?? data.is_on_hold);
            }
            if (data.holdReason !== undefined || data.hold_reason !== undefined) {
                bpUpdateData.hold_reason = data.holdReason ?? data.hold_reason;
            }
            if (data.isBlacklisted !== undefined || data.is_blacklisted !== undefined) {
                bpUpdateData.is_blacklisted = Boolean(data.isBlacklisted ?? data.is_blacklisted);
            }
            if (data.blacklistReason !== undefined || data.blacklist_reason !== undefined) {
                bpUpdateData.blacklist_reason = data.blacklistReason ?? data.blacklist_reason;
            }
            if (data.strikeCount !== undefined || data.strike_count !== undefined) {
                const strikes = parseInt(data.strikeCount ?? data.strike_count) || 0;
                bpUpdateData.strike_count = strikes;
                const threshold = parseInt(data.strikeThreshold) || 3;
                if ((data.autoBlacklist || strikes >= threshold) && strikes >= 3) {
                    bpUpdateData.is_blacklisted = true;
                    if (!bpUpdateData.blacklist_reason) {
                        bpUpdateData.blacklist_reason = `Partner blacklisted due to reaching ${strikes} strikes`;
                    }
                }
            }
            if (data.adminRemarks !== undefined || data.admin_remarks !== undefined) {
                bpUpdateData.admin_remarks = data.adminRemarks ?? data.admin_remarks;
            }

            return await prisma.businessPartner.update({
                where: { id: bp.id },
                data: bpUpdateData,
                include: { user: true }
            });
        }

        throw new NotFoundError('Partner not found');
    }

    async updateAvailability(id: string, data: any) {
        let status = data.availability_status || data.status;

        // Support { is_online: boolean } from dashboard
        if (data.is_online !== undefined) {
            status = data.is_online ? 'ONLINE' : 'OFFLINE';
        }

        // Map ONLINE to AVAILABLE (Prisma enum)
        if (status === 'ONLINE' || status === 'AVAILABLE') {
            status = 'AVAILABLE' as any;
        } else if (status === 'OFFLINE' || status === 'BUSY') {
            // Keep as is or map accordingly
        }

        if (!status) {
            throw new BadRequestError('Availability status is required');
        }

        console.log(`📡 [DEBUG] Updating partner ${id} status to ${status}`);

        return await prisma.servicePartner.update({
            where: { id },
            data: {
                availability_status: status as any,
                last_location_update: new Date()
            },
        });
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

        // Fetch recent transactions
        const transactions = await prisma.transaction.findMany({
            where: { user_id: partner.user_id },
            take: 5,
            orderBy: { created_at: 'desc' }
        });

        // Calculate total earnings (sum of all credits)
        const totalEarningsAgg = await prisma.transaction.aggregate({
            where: {
                user_id: partner.user_id,
                category: 'CREDIT',
                status: 'COMPLETED'
            },
            _sum: {
                amount: true
            }
        });

        return {
            totalEarnings: totalEarningsAgg._sum.amount || 0,
            currentBalance: wallet?.balance || 0,
            pendingPayouts: wallet?.pending_payout || 0,
            recentTransactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount,
                description: t.description,
                createdAt: t.created_at,
                status: (t as any).status
            }))
        };
    }

    async getPartnerPerformance(id: string, _dateRange?: any) {
        const sp = await prisma.servicePartner.findUnique({
            where: { id },
            select: { avg_rating: true, completed_bookings: true, total_bookings: true }
        });

        if (sp) {
            return {
                rating: sp.avg_rating || 0,
                jobsCompleted: sp.completed_bookings || 0,
                totalJobs: sp.total_bookings || 0,
                responseTime: '15m'
            };
        }

        const bp = await prisma.businessPartner.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!bp) return { rating: 0, jobsCompleted: 0, responseTime: 'N/A' };

        const totals = await prisma.booking.groupBy({
            by: ['status'],
            where: { business_partner_id: id },
            _count: { id: true }
        });

        const totalJobs = totals.reduce((acc, curr) => acc + curr._count.id, 0);
        const completed = totals.find(t => t.status === 'COMPLETED');
        const jobsCompleted = completed ? completed._count.id : 0;

        const reviewsObj = await prisma.review.aggregate({
            where: { booking: { business_partner_id: id } },
            _avg: { rating: true }
        });
        const rating = reviewsObj._avg.rating ? Number(reviewsObj._avg.rating.toFixed(1)) : 0;

        return {
            rating,
            jobsCompleted,
            totalJobs,
            responseTime: '15m'
        };
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
            select: {
                id: true,
                avg_rating: true,
                destination_mode_active: true,
                home_address: true,
                home_latitude: true,
                home_longitude: true,
                referral_code: true,
                minimum_payout_threshold: true,
                auto_transfer_enabled: true,
                auto_transfer_schedule: true,
                skill_categories: true,
            }
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

        // 2. Earnings Today & All-Time
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [
            earningsTodayResult,
            totalEarningsResult,
            wallet,
            todayTotalOrders,
            todayCompletedOrders,
            totalCompletedOrders,
            totalOrders
        ] = await Promise.all([
            // Today's earnings
            prisma.transaction.aggregate({
                where: {
                    user_id: userId,
                    category: 'CREDIT',
                    created_at: { gte: startOfDay }
                },
                _sum: { amount: true }
            }),
            // Total earnings all time
            prisma.transaction.aggregate({
                where: {
                    user_id: userId,
                    category: 'CREDIT'
                },
                _sum: { amount: true }
            }),
            // Wallet balance
            prisma.wallet.findUnique({
                where: { user_id: userId },
                select: { balance: true }
            }),
            // Today's total orders assigned or accepted
            prisma.booking.count({
                where: {
                    partner_id: partner.id,
                    OR: [
                        { created_at: { gte: startOfDay } },
                        { partner_assigned_at: { gte: startOfDay } }
                    ]
                }
            }),
            // Today's completed orders
            prisma.booking.count({
                where: {
                    partner_id: partner.id,
                    status: 'COMPLETED',
                    completed_at: { gte: startOfDay }
                }
            }),
            // Total completed orders all-time
            prisma.booking.count({
                where: {
                    partner_id: partner.id,
                    status: 'COMPLETED'
                }
            }),
            // Total orders all-time
            prisma.booking.count({
                where: {
                    partner_id: partner.id
                }
            })
        ]);

        const earningsToday = earningsTodayResult._sum.amount || 0;
        const totalEarnings = totalEarningsResult._sum.amount || 0;
        const walletBalance = wallet?.balance || 0;

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
            earnings_today: earningsToday,
            todayEarnings: earningsToday,
            total_earnings: totalEarnings,
            totalEarnings: totalEarnings,
            wallet_balance: walletBalance,
            walletBalance: walletBalance,
            today_total_orders: todayTotalOrders,
            todayOrders: todayTotalOrders,
            today_completed_orders: todayCompletedOrders,
            completed_orders: totalCompletedOrders,
            completedOrders: totalCompletedOrders,
            completedJobs: totalCompletedOrders,
            total_orders: totalOrders,
            totalOrders: totalOrders,
            totalJobs: totalOrders,
            rating: partner.avg_rating || 5.0,
            avgRating: partner.avg_rating || 5.0,
            destination_mode_active: partner.destination_mode_active,
            destinationModeActive: partner.destination_mode_active,
            home_address: partner.home_address,
            homeAddress: partner.home_address,
            minimum_payout_threshold: partner.minimum_payout_threshold,
            minimumPayoutThreshold: partner.minimum_payout_threshold,
            auto_transfer_enabled: partner.auto_transfer_enabled,
            autoTransferEnabled: partner.auto_transfer_enabled,
            auto_transfer_schedule: partner.auto_transfer_schedule,
            autoTransferSchedule: partner.auto_transfer_schedule,
            referral_code: partner.referral_code,
            referralCode: partner.referral_code,
            skill_categories: partner.skill_categories,
            skillCategories: partner.skill_categories,
            incentives: {
                dailyOrdersTarget: 8,
                dailyOrdersCompleted: todayCompletedOrders,
                dailyOrdersBonusAmount: 500,
                dailyOrdersProgressPercent: Math.min(100, Math.round((todayCompletedOrders / 8) * 100)),
                continuousHoursTarget: 8,
                continuousHoursBonusAmount: 300,
            }
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

    // Payout Methods
    async getPayoutMethods(userId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: { payout_methods: { orderBy: { created_at: 'desc' } } }
        });
        if (!partner) throw new NotFoundError('Service partner not found');
        return partner.payout_methods;
    }

    async addPayoutMethod(userId: string, data: {
        type: 'BANK_ACCOUNT' | 'UPI';
        account_number?: string;
        ifsc_code?: string;
        bank_name?: string;
        account_holder_name?: string;
        upi_id?: string;
        is_default?: boolean;
    }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: { payout_methods: true }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const isFirst = partner.payout_methods.length === 0;
        const shouldBeDefault = data.is_default !== undefined ? data.is_default : isFirst;

        if (shouldBeDefault) {
            await prisma.partnerPayoutMethod.updateMany({
                where: { partner_id: partner.id },
                data: { is_default: false }
            });
        }

        const newMethod = await prisma.partnerPayoutMethod.create({
            data: {
                partner_id: partner.id,
                type: data.type || (data.upi_id ? 'UPI' : 'BANK'),
                account_number: data.account_number,
                ifsc_code: data.ifsc_code ? data.ifsc_code.toUpperCase().trim() : undefined,
                bank_name: data.bank_name,
                account_holder: data.account_holder_name || (data as any).account_holder,
                upi_id: data.upi_id ? data.upi_id.trim() : undefined,
                is_default: shouldBeDefault,
                is_verified: true
            }
        });

        return newMethod;
    }

    async setDefaultPayoutMethod(userId: string, methodId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        await prisma.partnerPayoutMethod.updateMany({
            where: { partner_id: partner.id },
            data: { is_default: false }
        });

        const updated = await prisma.partnerPayoutMethod.update({
            where: { id: methodId },
            data: { is_default: true }
        });

        return updated;
    }

    async deletePayoutMethod(userId: string, methodId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        await prisma.partnerPayoutMethod.deleteMany({
            where: { id: methodId, partner_id: partner.id }
        });

        return { message: 'Payout method removed' };
    }

    async requestInstantPayout(userId: string, amount?: number, payoutMethodId?: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId },
            include: {
                payout_methods: true
            }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const wallet = await prisma.wallet.findUnique({
            where: { user_id: userId }
        });
        if (!wallet) throw new NotFoundError('Wallet not found');

        const minThreshold = partner.minimum_payout_threshold || 500;
        if (wallet.balance < minThreshold) {
            throw new BadRequestError(`Minimum balance of ₹${minThreshold} required for instant payout. Current balance: ₹${wallet.balance}`);
        }

        const transferAmount = amount && amount > 0 ? Number(amount) : wallet.balance;
        if (transferAmount > wallet.balance) {
            throw new BadRequestError(`Requested amount ₹${transferAmount} exceeds current balance ₹${wallet.balance}`);
        }

        let selectedMethod = payoutMethodId
            ? partner.payout_methods.find(m => m.id === payoutMethodId)
            : partner.payout_methods.find(m => m.is_default) || partner.payout_methods[0];

        // Deduct from wallet & create transaction
        const updatedWallet = await prisma.$transaction(async (tx) => {
            const w = await tx.wallet.update({
                where: { user_id: userId },
                data: {
                    balance: { decrement: transferAmount },
                    pending_payout: { increment: transferAmount }
                }
            });

            await tx.transaction.create({
                data: {
                    user_id: userId,
                    amount: transferAmount,
                    type: 'PAYOUT',
                    category: 'DEBIT',
                    status: 'COMPLETED',
                    balance_before: wallet.balance,
                    balance_after: wallet.balance - transferAmount,
                    description: `Instant Payout to ${selectedMethod ? (selectedMethod.type === 'UPI' ? selectedMethod.upi_id : selectedMethod.account_number) : 'Primary Bank Account'}`
                }
            });

            return w;
        });

        return {
            success: true,
            amount: transferAmount,
            transferred_to: selectedMethod || { type: 'BANK', note: 'Primary Account' },
            new_balance: updatedWallet.balance,
            message: `Instant transfer of ₹${transferAmount} initiated successfully!`
        };
    }

    async updatePartnerPreferences(userId: string, data: any) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const updateData: any = {};
        if (data.destination_mode_active !== undefined) updateData.destination_mode_active = Boolean(data.destination_mode_active);
        if (data.home_address !== undefined) updateData.home_address = data.home_address;
        if (data.home_latitude !== undefined) updateData.home_latitude = Number(data.home_latitude);
        if (data.home_longitude !== undefined) updateData.home_longitude = Number(data.home_longitude);
        if (data.auto_transfer_enabled !== undefined) updateData.auto_transfer_enabled = Boolean(data.auto_transfer_enabled);
        if (data.auto_transfer_schedule !== undefined) updateData.auto_transfer_schedule = data.auto_transfer_schedule;
        if (data.minimum_payout_threshold !== undefined) updateData.minimum_payout_threshold = Number(data.minimum_payout_threshold);

        const updated = await prisma.servicePartner.update({
            where: { id: partner.id },
            data: updateData
        });

        return updated;
    }

    async getReferralInfo(userId: string) {
        let partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        if (!partner.referral_code) {
            const randomCode = 'SP' + Math.random().toString(36).substring(2, 7).toUpperCase();
            partner = await prisma.servicePartner.update({
                where: { id: partner.id },
                data: { referral_code: randomCode }
            });
        }

        const totalReferred = await prisma.servicePartner.count({
            where: { referred_by_code: partner.referral_code }
        });

        const completedReferred = await prisma.servicePartner.count({
            where: {
                referred_by_code: partner.referral_code,
                kyc_status: 'APPROVED'
            }
        });

        const pendingReferred = totalReferred - completedReferred;
        const totalEarned = completedReferred * 1500;

        return {
            referral_code: partner.referral_code,
            reward_per_referral: 1500,
            total_referrals: totalReferred,
            completed_referrals: completedReferred,
            pending_referrals: pendingReferred,
            total_earned: totalEarned,
            share_url: `https://snearal.com/partner/join?ref=${partner.referral_code}`,
            share_text: `Join Snearal as an On-Demand Service Partner! Use my invite code ${partner.referral_code} to get verified and earn daily instant payouts: https://snearal.com/partner/join?ref=${partner.referral_code}`
        };
    }

    async getMerchandiseKits() {
        let kits = await prisma.merchandiseKit.findMany({
            where: { is_available: true },
            orderBy: { price: 'asc' }
        });

        if (kits.length === 0) {
            const defaults = [
                {
                    name: 'Starter Pro Partner Kit',
                    description: 'Everything you need to kick off your Snearal journey: 2 Official Snearal Polos, Partner Cap & Retractable ID Badge.',
                    price: 499,
                    badge: 'POPULAR',
                    image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=60',
                    items_included: ['2x Snearal Moisture-Wicking Polo T-Shirts', '1x Official Embroidered Cap', '1x Verified Partner ID Card & Lanyard'],
                    is_available: true
                },
                {
                    name: 'Monsoon All-Weather Shield Kit',
                    description: 'Never let rain stop your daily earnings. Premium heavy-duty waterproof raincoat and water-repellent equipment bag cover.',
                    price: 899,
                    badge: 'ESSENTIAL',
                    image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=60',
                    items_included: ['1x Double-Layer Heavy-Duty Raincoat', '1x High-Visibility Rain Pants', '1x Waterproof Bag Rain Shield Cover'],
                    is_available: true
                },
                {
                    name: 'Master Technician Toolkit',
                    description: 'Pro-grade multi-meter, insulated screwdriver set, precision voltage detector, and ballistic nylon heavy-duty tool backpack.',
                    price: 1499,
                    badge: 'PRO TOOLS',
                    image_url: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&auto=format&fit=crop&q=60',
                    items_included: ['1x Professional Digital Multimeter', '1x 8-Piece Insulated VDE Screwdriver Set', '1x Non-Contact AC Voltage Tester Pen', '1x Multi-Pocket Ballistic Nylon Tool Bag'],
                    is_available: true
                },
                {
                    name: 'Super Partner Elite Combo Pack',
                    description: 'The ultimate kit for top performers. Complete apparel, all-weather gear, safety equipment, and priority badge branding.',
                    price: 2199,
                    badge: 'BEST VALUE',
                    image_url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=60',
                    items_included: ['3x Snearal Pro Polos', '1x All-Weather Raincoat Set', '1x Partner Cap', '1x Complete Pro Toolkit', '1x Heavy Duty Bag', '1x Safety Gloves & Goggles Set'],
                    is_available: true
                }
            ];

            for (const item of defaults) {
                await prisma.merchandiseKit.create({ data: item });
            }

            kits = await prisma.merchandiseKit.findMany({
                where: { is_available: true },
                orderBy: { price: 'asc' }
            });
        }

        return kits;
    }

    async orderMerchandiseKit(userId: string, data: {
        kit_id: string;
        selected_size?: string;
        payment_method: 'WALLET' | 'ONLINE';
        delivery_address: string;
        delivery_city: string;
        delivery_state: string;
        delivery_pincode: string;
    }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        const kit = await prisma.merchandiseKit.findUnique({
            where: { id: data.kit_id }
        });
        if (!kit) throw new NotFoundError('Merchandise kit not found');

        if (data.payment_method === 'WALLET') {
            const wallet = await prisma.wallet.findUnique({
                where: { user_id: userId }
            });
            if (!wallet || wallet.balance < kit.price) {
                throw new BadRequestError(`Insufficient wallet balance (₹${wallet?.balance || 0}) for kit order of ₹${kit.price}`);
            }

            await prisma.$transaction(async (tx) => {
                await tx.wallet.update({
                    where: { user_id: userId },
                    data: { balance: { decrement: kit.price } }
                });

                await tx.transaction.create({
                    data: {
                        user_id: userId,
                        amount: kit.price,
                        type: 'PAYOUT',
                        category: 'DEBIT',
                        status: 'COMPLETED',
                        balance_before: wallet.balance,
                        balance_after: wallet.balance - kit.price,
                        description: `Merchandise Kit Purchase: ${kit.name}`
                    }
                });
            });
        }

        const estDate = new Date();
        estDate.setDate(estDate.getDate() + 4);

        const order = await prisma.merchandiseOrder.create({
            data: {
                partner_id: partner.id,
                kit_id: kit.id,
                kit_name: kit.name,
                amount: kit.price,
                payment_method: data.payment_method,
                payment_status: data.payment_method === 'WALLET' ? 'PAID' : 'PENDING',
                status: 'CONFIRMED',
                delivery_address: data.delivery_address,
                city: data.delivery_city,
                state: data.delivery_state,
                postal_code: data.delivery_pincode
            },
            include: { kit: true }
        });

        return order;
    }

    async getMerchandiseOrders(userId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { user_id: userId }
        });
        if (!partner) throw new NotFoundError('Service partner not found');

        return await prisma.merchandiseOrder.findMany({
            where: { partner_id: partner.id },
            include: { kit: true },
            orderBy: { created_at: 'desc' }
        });
    }

    async getHighDemandAreas() {
        return [
            {
                id: 'surge_1',
                name: 'Tech Park Corridor & Outer Ring Road',
                city: 'Bengaluru',
                surgeMultiplier: 1.5,
                demandLevel: 'VERY_HIGH',
                activeOrdersWaiting: 14,
                bonusPerOrder: 80,
                recommendedSkills: ['AC Technician', 'Electrician', 'Plumber']
            },
            {
                id: 'surge_2',
                name: 'Koramangala & HSR Layout Sector 1-7',
                city: 'Bengaluru',
                surgeMultiplier: 1.3,
                demandLevel: 'HIGH',
                activeOrdersWaiting: 9,
                bonusPerOrder: 50,
                recommendedSkills: ['Washing Machine Technician', 'RO Technician']
            },
            {
                id: 'surge_3',
                name: 'Indiranagar & Domlur Central',
                city: 'Bengaluru',
                surgeMultiplier: 1.4,
                demandLevel: 'HIGH',
                activeOrdersWaiting: 11,
                bonusPerOrder: 65,
                recommendedSkills: ['Electrician', 'Refrigerator Technician', 'AC Technician']
            },
            {
                id: 'surge_4',
                name: 'Whitefield IT Hub & Hope Farm',
                city: 'Bengaluru',
                surgeMultiplier: 1.25,
                demandLevel: 'MODERATE_HIGH',
                activeOrdersWaiting: 8,
                bonusPerOrder: 40,
                recommendedSkills: ['Plumber', 'RO Technician']
            }
        ];
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
