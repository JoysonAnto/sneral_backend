import prisma from '../config/database';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../utils/errors';
import { hashPassword } from '../utils/encryption';

interface CreatePartnerData {
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    services?: string[];
}

export class PartnerService {
    async getAllPartners(filters: any, userRole: string) {
        const { type, status, verified, page = 1, limit = 20, search } = filters;

        const skip = (page - 1) * limit;

        let where: any = {};

        // Build where clause based on filters
        if (search) {
            where.user = {
                OR: [
                    { full_name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            };
        }

        if (verified === 'true') {
            where.kyc_status = 'APPROVED';
        } else if (verified === 'false') {
            where.kyc_status = { in: ['PENDING', 'PENDING_VERIFICATION', 'REJECTED'] };
        }

        // Status filter removed - is_active field doesn't exist in schema

        // Get service or business partners based on type
        const modelToUse = type === 'BUSINESS_PARTNER' ? 'businessPartner' : 'servicePartner';

        const [partners, total] = await Promise.all([
            (prisma[modelToUse] as any).findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            full_name: true,
                            phone_number: true,
                            role: true,
                            created_at: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            (prisma[modelToUse] as any).count({ where }),
        ]);

        return {
            partners: partners.map((p: any) => ({
                id: p.id,
                userId: p.user.id,
                email: p.user.email,
                fullName: p.user.full_name,
                phoneNumber: p.user.phone_number,
                role: p.user.role,
                kycStatus: p.kyc_status,
                avgRating: p.avg_rating || 0,
                totalBookings: p.total_bookings || 0,
                completedBookings: p.completed_bookings || 0,
                ...(type !== 'BUSINESS_PARTNER' && {
                    availabilityStatus: p.availability_status,
                    completionRate: p.completion_rate,
                }),
                createdAt: p.created_at,
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
            },
        };
    }

    async getPartnerById(partnerId: string, userId: string, userRole: string) {
        // Try to find in both service and business partners
        const [servicePartner, businessPartner] = await Promise.all([
            prisma.servicePartner.findUnique({
                where: { id: partnerId },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            full_name: true,
                            phone_number: true,
                            role: true,
                            profile: true,
                        },
                    },
                    business_partner: {
                        select: {
                            id: true,
                            business_name: true,
                        },
                    },
                },
            }),
            prisma.businessPartner.findUnique({
                where: { id: partnerId },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            full_name: true,
                            phone_number: true,
                            role: true,
                            profile: true,
                        },
                    },
                    service_partners: {
                        select: {
                            id: true,
                            user: {
                                select: {
                                    full_name: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        const partner = servicePartner || businessPartner;

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        // Check if user has permission to view this partner
        const isOwnProfile = partner.user.id === userId;
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

        if (!isOwnProfile && !isAdmin) {
            throw new UnauthorizedError('Access denied');
        }

        // Return formatted response
        if (servicePartner) {
            return {
                id: servicePartner.id,
                userId: servicePartner.user.id,
                email: servicePartner.user.email,
                fullName: servicePartner.user.full_name,
                phoneNumber: servicePartner.user.phone_number,
                role: servicePartner.user.role,
                profile: servicePartner.user.profile,
                businessPartner: servicePartner.business_partner ? {
                    id: servicePartner.business_partner.id,
                    name: servicePartner.business_partner.business_name,
                } : null,
                availabilityStatus: servicePartner.availability_status,
                currentLocation: {
                    latitude: servicePartner.current_latitude,
                    longitude: servicePartner.current_longitude,
                },
                serviceRadius: servicePartner.service_radius,
                kycStatus: servicePartner.kyc_status,
                kycVerifiedAt: servicePartner.kyc_verified_at,
                avgRating: servicePartner.avg_rating,
                totalRatings: servicePartner.total_ratings,
                completionRate: servicePartner.completion_rate,
                totalBookings: servicePartner.total_bookings,
                completedBookings: servicePartner.completed_bookings,
                bankDetails: {
                    accountNumber: servicePartner.bank_account_number,
                    ifscCode: servicePartner.bank_ifsc_code,
                    accountName: servicePartner.bank_account_name,
                },
                createdAt: servicePartner.created_at,
            };
        } else {
            return {
                id: businessPartner!.id,
                userId: businessPartner!.user.id,
                email: businessPartner!.user.email,
                fullName: businessPartner!.user.full_name,
                phoneNumber: businessPartner!.user.phone_number,
                role: businessPartner!.user.role,
                profile: businessPartner!.user.profile,
                businessName: businessPartner!.business_name,
                businessType: businessPartner!.business_type,
                businessLicense: businessPartner!.business_license,
                gstNumber: businessPartner!.gst_number,
                kycStatus: businessPartner!.kyc_status,
                kycVerifiedAt: businessPartner!.kyc_verified_at,
                commissionRate: businessPartner!.commission_rate,
                servicePartnersCount: businessPartner!.service_partners.length,
                bankDetails: {
                    accountNumber: businessPartner!.bank_account_number,
                    ifscCode: businessPartner!.bank_ifsc_code,
                    accountName: businessPartner!.bank_account_name,
                },
                createdAt: businessPartner!.created_at,
            };
        }
    }

    async createServicePartner(data: CreatePartnerData, createdBy: string, creatorRole: string) {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new BadRequestError('Email already registered');
        }

        // Hash password
        const hashedPassword = await hashPassword(data.password);

        // Get business partner ID if creator is business partner
        let businessPartnerId: string | null = null;
        if (creatorRole === 'BUSINESS_PARTNER') {
            const businessPartner = await prisma.businessPartner.findUnique({
                where: { user_id: createdBy },
            });
            businessPartnerId = businessPartner?.id || null;
        }

        // Create user and service partner in transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: data.email,
                    password: hashedPassword,
                    full_name: data.fullName,
                    phone_number: data.phoneNumber,
                    role: 'SERVICE_PARTNER',
                    email_verified: true, // Auto-verify for admin-created partners
                },
            });

            const servicePartner = await tx.servicePartner.create({
                data: {
                    user_id: user.id,
                    business_partner_id: businessPartnerId,
                    availability_status: 'OFFLINE',
                    kyc_status: 'PENDING',
                },
            });

            // Add services if provided
            if (data.services && data.services.length > 0) {
                await tx.partnerService.createMany({
                    data: data.services.map(serviceId => ({
                        service_id: serviceId,
                        partner_id: servicePartner.id,
                        is_available: true,
                    })),
                });
            }

            return { user, servicePartner };
        });

        return {
            id: result.servicePartner.id,
            userId: result.user.id,
            email: result.user.email,
            fullName: result.user.full_name,
            phoneNumber: result.user.phone_number,
            message: 'Service partner created successfully',
        };
    }

    async updatePartner(partnerId: string, data: any, userId: string, userRole: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
            include: { user: true },
        });

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        // Check permissions
        const isOwnProfile = partner.user_id === userId;
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

        if (!isOwnProfile && !isAdmin) {
            throw new UnauthorizedError('Access denied');
        }

        // Update user and partner data
        const updated = await prisma.$transaction(async (tx) => {
            if (data.fullName || data.phoneNumber) {
                await tx.user.update({
                    where: { id: partner.user_id },
                    data: {
                        ...(data.fullName && { full_name: data.fullName }),
                        ...(data.phoneNumber && { phone_number: data.phoneNumber }),
                    },
                });
            }

            const updatedPartner = await tx.servicePartner.update({
                where: { id: partnerId },
                data: {
                    ...(data.serviceRadius && { service_radius: data.serviceRadius }),
                    ...(data.bankAccountNumber && { bank_account_number: data.bankAccountNumber }),
                    ...(data.bankIfscCode && { bank_ifsc_code: data.bankIfscCode }),
                    ...(data.bankAccountName && { bank_account_name: data.bankAccountName }),
                },
                include: { user: true },
            });

            return updatedPartner;
        });

        return {
            id: updated.id,
            fullName: updated.user.full_name,
            phoneNumber: updated.user.phone_number,
            serviceRadius: updated.service_radius,
            updatedAt: updated.updated_at,
        };
    }

    async updateAvailability(partnerId: string, data: { isAvailable: boolean; latitude?: number; longitude?: number }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
        });

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        const updated = await prisma.servicePartner.update({
            where: { id: partnerId },
            data: {
                availability_status: data.isAvailable ? 'AVAILABLE' : 'OFFLINE',
                ...(data.latitude && { current_latitude: data.latitude }),
                ...(data.longitude && { current_longitude: data.longitude }),
            },
        });

        return {
            availabilityStatus: updated.availability_status,
            currentLocation: {
                latitude: updated.current_latitude,
                longitude: updated.current_longitude,
            },
            updatedAt: updated.updated_at,
        };
    }

    async getPartnerServices(partnerId: string) {
        const services = await prisma.partnerService.findMany({
            where: { partner_id: partnerId },
            include: {
                service: {
                    include: {
                        category: true,
                    },
                },
            },
        });

        return services.map(ps => ({
            id: ps.id,
            serviceId: ps.service.id,
            serviceName: ps.service.name,
            category: ps.service.category.name,
            basePrice: ps.service.base_price,
            customPrice: ps.custom_price,
            isAvailable: ps.is_available,
            duration: ps.service.duration,
        }));
    }

    async updatePartnerService(partnerId: string, data: { serviceId: string; customPrice?: number; isAvailable?: boolean }) {
        const partnerService = await prisma.partnerService.findFirst({
            where: {
                partner_id: partnerId,
                service_id: data.serviceId,
            },
        });

        if (!partnerService) {
            // Create if doesn't exist
            const created = await prisma.partnerService.create({
                data: {
                    partner_id: partnerId,
                    service_id: data.serviceId,
                    custom_price: data.customPrice,
                    is_available: data.isAvailable !== undefined ? data.isAvailable : true,
                },
            });
            return created;
        }

        // Update existing
        const updated = await prisma.partnerService.update({
            where: { id: partnerService.id },
            data: {
                ...(data.customPrice !== undefined && { custom_price: data.customPrice }),
                ...(data.isAvailable !== undefined && { is_available: data.isAvailable }),
            },
        });

        return updated;
    }

    async getPartnerEarnings(partnerId: string) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
            include: {
                user: {
                    include: {
                        wallet: true,
                        transactions: {
                            where: {
                                type: { in: ['BOOKING_PAYMENT', 'COMMISSION'] },
                            },
                            orderBy: { created_at: 'desc' },
                            take: 10,
                        },
                    },
                },
            },
        });

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        // Calculate total earnings from completed bookings
        const completedBookings = await prisma.booking.findMany({
            where: {
                partner_id: partnerId,
                status: { in: ['COMPLETED', 'RATED'] },
            },
            select: {
                total_amount: true,
            },
        });

        const totalEarnings = completedBookings.reduce((sum, b) => sum + b.total_amount, 0);
        const platformCommission = totalEarnings * 0.15; // 15% commission
        const netEarnings = totalEarnings - platformCommission;

        return {
            totalEarnings: netEarnings,
            currentBalance: partner.user.wallet?.balance || 0,
            pendingPayouts: partner.user.wallet?.locked_balance || 0,
            completedBookings: partner.completed_bookings,
            totalBookings: partner.total_bookings,
            avgRating: partner.avg_rating,
            recentTransactions: partner.user.transactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount,
                description: t.description,
                createdAt: t.created_at,
            })),
        };
    }

    // ====================
    // PARTNER ENHANCEMENTS
    // ====================

    // Performance Analytics
    async getPartnerPerformance(partnerId: string, dateRange?: { start: Date; end: Date }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
        });

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        const whereBooking: any = { partner_id: partnerId };
        if (dateRange) {
            whereBooking.created_at = {
                gte: dateRange.start,
                lte: dateRange.end,
            };
        }

        // Get bookings data
        const [bookings, ratings] = await Promise.all([
            prisma.booking.findMany({
                where: whereBooking,
                select: {
                    id: true,
                    status: true,
                    total_amount: true,
                    created_at: true,
                    partner_accepted_at: true,
                    completed_at: true,
                },
            }),
            prisma.rating.findMany({
                where: { partner_id: partnerId },
                select: { rating: true, review: true, created_at: true },
            }),
        ]);

        // Calculate metrics
        const totalBookings = bookings.length;
        const completedBookings = bookings.filter(b => ['COMPLETED', 'RATED'].includes(b.status)).length;
        const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED').length;
        const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
        const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;

        // Calculate average response time (time to accept booking)
        const responseTimes = bookings
            .filter(b => b.partner_accepted_at)
            .map(b => {
                const createdAt = new Date(b.created_at).getTime();
                const acceptedAt = new Date(b.partner_accepted_at!).getTime();
                return (acceptedAt - createdAt) / (1000 * 60); // minutes
            });
        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            : 0;

        // Calculate total revenue
        const totalRevenue = completedBookings > 0
            ? bookings
                .filter(b => ['COMPLETED', 'RATED'].includes(b.status))
                .reduce((sum, b) => sum + b.total_amount, 0)
            : 0;

        // Rating distribution
        const ratingDistribution = {
            5: ratings.filter(r => r.rating === 5).length,
            4: ratings.filter(r => r.rating === 4).length,
            3: ratings.filter(r => r.rating === 3).length,
            2: ratings.filter(r => r.rating === 2).length,
            1: ratings.filter(r => r.rating === 1).length,
        };

        return {
            partnerId,
            metrics: {
                totalBookings,
                completedBookings,
                cancelledBookings,
                completionRate: parseFloat(completionRate.toFixed(2)),
                cancellationRate: parseFloat(cancellationRate.toFixed(2)),
                avgResponseTime: parseFloat(avgResponseTime.toFixed(2)), // in minutes
                totalRevenue,
                avgRating: partner.avg_rating,
                totalRatings: partner.total_ratings,
            },
            ratingDistribution,
            recentReviews: ratings.slice(0, 5).map(r => ({
                rating: r.rating,
                review: r.review,
                createdAt: r.created_at,
            })),
        };
    }

    // Team Management (Business Partners)
    async addTeamMember(businessPartnerId: string, servicePartnerId: string, adminId: string) {
        // Verify business partner exists
        const businessPartner = await prisma.businessPartner.findUnique({
            where: { id: businessPartnerId },
        });

        if (!businessPartner) {
            throw new NotFoundError('Business partner not found');
        }

        // Verify service partner exists and is not already assigned
        const servicePartner = await prisma.servicePartner.findUnique({
            where: { id: servicePartnerId },
        });

        if (!servicePartner) {
            throw new NotFoundError('Service partner not found');
        }

        if (servicePartner.business_partner_id) {
            throw new BadRequestError('Service partner is already assigned to a business');
        }

        // Assign service partner to business partner
        const updated = await prisma.servicePartner.update({
            where: { id: servicePartnerId },
            data: { business_partner_id: businessPartnerId },
            include: {
                user: {
                    select: {
                        full_name: true,
                        email: true,
                    },
                },
            },
        });

        return {
            message: 'Team member added successfully',
            teamMember: {
                id: updated.id,
                name: updated.user.full_name,
                email: updated.user.email,
            },
        };
    }

    async removeTeamMember(businessPartnerId: string, servicePartnerId: string, adminId: string) {
        const servicePartner = await prisma.servicePartner.findUnique({
            where: { id: servicePartnerId },
        });

        if (!servicePartner) {
            throw new NotFoundError('Service partner not found');
        }

        if (servicePartner.business_partner_id !== businessPartnerId) {
            throw new BadRequestError('Service partner is not part of this business');
        }

        // Remove assignment
        await prisma.servicePartner.update({
            where: { id: servicePartnerId },
            data: { business_partner_id: null },
        });

        return { message: 'Team member removed successfully' };
    }

    async getTeamMembers(businessPartnerId: string) {
        const members = await prisma.servicePartner.findMany({
            where: { business_partner_id: businessPartnerId },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                        phone_number: true,
                    },
                },
            },
        });

        return members.map(m => ({
            id: m.id,
            userId: m.user.id,
            name: m.user.full_name,
            email: m.user.email,
            phoneNumber: m.user.phone_number,
            kycStatus: m.kyc_status,
            availabilityStatus: m.availability_status,
            avgRating: m.avg_rating,
            totalBookings: m.total_bookings,
            completedBookings: m.completed_bookings,
            completionRate: m.completion_rate,
            joinedAt: m.created_at,
        }));
    }

    async getTeamPerformance(businessPartnerId: string) {
        const members = await this.getTeamMembers(businessPartnerId);

        const totalBookings = members.reduce((sum, m) => sum + m.totalBookings, 0);
        const totalCompleted = members.reduce((sum, m) => sum + m.completedBookings, 0);
        const avgTeamRating = members.length > 0
            ? members.reduce((sum, m) => sum + m.avgRating, 0) / members.length
            : 0;

        return {
            teamSize: members.length,
            totalBookings,
            totalCompleted,
            avgTeamRating: parseFloat(avgTeamRating.toFixed(2)),
            members: members.sort((a, b) => b.totalBookings - a.totalBookings),
        };
    }

    // Service Management
    async assignServiceToPartner(partnerId: string, serviceId: string, options?: { customPrice?: number; expertiseLevel?: string }) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
        });

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        // Check if already assigned
        const existing = await prisma.partnerService.findFirst({
            where: {
                partner_id: partnerId,
                service_id: serviceId,
            },
        });

        if (existing) {
            throw new BadRequestError('Service already assigned to partner');
        }

        const partnerService = await prisma.partnerService.create({
            data: {
                partner_id: partnerId,
                service_id: serviceId,
                custom_price: options?.customPrice,
                is_available: true,
            },
        });

        return {
            message: 'Service assigned successfully',
            partnerService,
        };
    }

    // Commission Management
    async updateCommissionRate(partnerId: string, rate: number, changedBy: string) {
        if (rate < 0 || rate > 1) {
            throw new BadRequestError('Commission rate must be between 0 and 1');
        }

        const businessPartner = await prisma.businessPartner.findUnique({
            where: { id: partnerId },
        });

        if (!businessPartner) {
            throw new NotFoundError('Business partner not found');
        }

        const updated = await prisma.businessPartner.update({
            where: { id: partnerId },
            data: { commission_rate: rate },
        });

        return {
            message: 'Commission rate updated successfully',
            partnerId: updated.id,
            oldRate: businessPartner.commission_rate,
            newRate: updated.commission_rate,
            changedBy,
            changedAt: new Date(),
        };
    }

    async getCommissionHistory(partnerId: string) {
        // This would require a CommissionHistory table which doesn't exist yet
        // For now, return current commission rate
        const businessPartner = await prisma.businessPartner.findUnique({
            where: { id: partnerId },
        });

        if (!businessPartner) {
            throw new NotFoundError('Business partner not found');
        }

        return {
            currentRate: businessPartner.commission_rate,
            history: [], // TODO: Implement commission history tracking
        };
    }

    // Bulk Service Assignment
    async bulkAssignServices(partnerIds: string[], serviceIds: string[]) {
        const assignments: any[] = [];

        for (const partnerId of partnerIds) {
            for (const serviceId of serviceIds) {
                assignments.push({
                    partner_id: partnerId,
                    service_id: serviceId,
                    is_available: true,
                });
            }
        }

        // Use createMany with skipDuplicates to avoid errors on existing assignments
        const result = await prisma.partnerService.createMany({
            data: assignments,
            skipDuplicates: true,
        });

        return {
            message: 'Services assigned successfully',
            assigned: result.count,
        };
    }

    // ====================
    // PHASE 2: ANALYTICS & REPORTING
    // ====================

    // Partner Analytics Aggregation
    async getPartnersAnalytics(filters?: { startDate?: Date; endDate?: Date; type?: string }) {
        const { startDate, endDate, type } = filters || {};

        // Build date filter
        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.created_at = {};
            if (startDate) dateFilter.created_at.gte = startDate;
            if (endDate) dateFilter.created_at.lte = endDate;
        }

        // Get counts by type
        const [servicePartnersCount, businessPartnersCount] = await Promise.all([
            prisma.servicePartner.count({ where: type !== 'BUSINESS_PARTNER' ? dateFilter : undefined }),
            prisma.businessPartner.count({ where: type !== 'SERVICE_PARTNER' ? dateFilter : undefined }),
        ]);

        const totalPartners = servicePartnersCount + businessPartnersCount;

        // Get aggregate metrics from service partners
        const servicePartnerMetrics = await prisma.servicePartner.aggregate({
            where: type !== 'BUSINESS_PARTNER' ? dateFilter : undefined,
            _avg: {
                avg_rating: true,
                completion_rate: true,
            },
            _sum: {
                total_bookings: true,
                completed_bookings: true,
            },
        });

        // Calculate total revenue from completed bookings
        const completedBookings = await prisma.booking.findMany({
            where: {
                status: { in: ['COMPLETED', 'RATED'] },
                ...(startDate || endDate ? { created_at: dateFilter.created_at } : {}),
            },
            select: {
                total_amount: true,
            },
        });

        const totalRevenue = completedBookings.reduce((sum, b) => sum + b.total_amount, 0);

        // Get active partners (those with recent bookings in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activeServicePartners = await prisma.servicePartner.count({
            where: {
                bookings: {
                    some: {
                        created_at: { gte: thirtyDaysAgo },
                    },
                },
            },
        });

        return {
            overview: {
                totalPartners,
                servicePartners: servicePartnersCount,
                businessPartners: businessPartnersCount,
                activePartners: activeServicePartners,
                activePercentage: totalPartners > 0 ? ((activeServicePartners / totalPartners) * 100).toFixed(1) : 0,
            },
            performance: {
                avgRating: servicePartnerMetrics._avg.avg_rating || 0,
                avgCompletionRate: servicePartnerMetrics._avg.completion_rate || 0,
                totalBookings: servicePartnerMetrics._sum.total_bookings || 0,
                completedBookings: servicePartnerMetrics._sum.completed_bookings || 0,
                totalRevenue,
            },
            dateRange: {
                startDate,
                endDate,
            },
        };
    }

    // Top Performers
    async getTopPerformers(params?: { sortBy?: string; limit?: number; type?: string }) {
        const { sortBy = 'revenue', limit = 10, type } = params || {};

        const whereClause: any = {};
        if (type === 'BUSINESS_PARTNER') {
            return []; // Business partners don't have individual performance metrics
        }

        let orderBy: any = {};
        switch (sortBy) {
            case 'revenue':
                // We'll calculate revenue separately since it's not directly in the model
                orderBy = { completed_bookings: 'desc' }; // Proxy for revenue
                break;
            case 'bookings':
                orderBy = { total_bookings: 'desc' };
                break;
            case 'rating':
                orderBy = { avg_rating: 'desc' };
                break;
            case 'completionRate':
                orderBy = { completion_rate: 'desc' };
                break;
            default:
                orderBy = { total_bookings: 'desc' };
        }

        const topPartners = await prisma.servicePartner.findMany({
            where: whereClause,
            take: limit,
            orderBy,
            include: {
                user: {
                    select: {
                        full_name: true,
                        email: true,
                    },
                },
            },
        });

        // Calculate actual revenue for each partner
        const partnersWithRevenue = await Promise.all(
            topPartners.map(async (partner) => {
                const bookings = await prisma.booking.findMany({
                    where: {
                        partner_id: partner.id,
                        status: { in: ['COMPLETED', 'RATED'] },
                    },
                    select: {
                        total_amount: true,
                    },
                });

                const revenue = bookings.reduce((sum, b) => sum + b.total_amount, 0);

                return {
                    id: partner.id,
                    name: partner.user.full_name,
                    email: partner.user.email,
                    totalBookings: partner.total_bookings,
                    completedBookings: partner.completed_bookings,
                    completionRate: partner.completion_rate,
                    avgRating: partner.avg_rating,
                    revenue,
                };
            })
        );

        // Re-sort by actual revenue if that's the sort criteria
        if (sortBy === 'revenue') {
            partnersWithRevenue.sort((a, b) => b.revenue - a.revenue);
        }

        return partnersWithRevenue;
    }

    // Commission Report
    async getCommissionReport(dateRange?: { start: Date; end: Date }) {
        const { start, end } = dateRange || {};

        // Get all business partners with their commission rates
        const businessPartners = await prisma.businessPartner.findMany({
            include: {
                user: {
                    select: {
                        full_name: true,
                    },
                },
                service_partners: {
                    include: {
                        bookings: {
                            where: {
                                status: { in: ['COMPLETED', 'RATED'] },
                                ...(start || end
                                    ? {
                                        completed_at: {
                                            ...(start ? { gte: start } : {}),
                                            ...(end ? { lte: end } : {}),
                                        },
                                    }
                                    : {}),
                            },
                            select: {
                                total_amount: true,
                            },
                        },
                    },
                },
            },
        });

        const report = businessPartners.map((bp) => {
            // Calculate total revenue from all team members' bookings
            const totalRevenue = bp.service_partners.reduce((sum, sp) => {
                const partnerRevenue = sp.bookings.reduce((s, b) => s + b.total_amount, 0);
                return sum + partnerRevenue;
            }, 0);

            const commissionCollected = totalRevenue * bp.commission_rate;

            return {
                businessPartnerId: bp.id,
                businessName: bp.business_name,
                contactName: bp.user.full_name,
                commissionRate: bp.commission_rate,
                teamSize: bp.service_partners.length,
                totalRevenue,
                commissionCollected,
            };
        });

        const totalCommission = report.reduce((sum, r) => sum + r.commissionCollected, 0);
        const totalRevenue = report.reduce((sum, r) => sum + r.totalRevenue, 0);

        return {
            summary: {
                totalBusinessPartners: businessPartners.length,
                totalRevenue,
                totalCommission,
                avgCommissionRate:
                    businessPartners.length > 0
                        ? businessPartners.reduce((sum, bp) => sum + bp.commission_rate, 0) /
                        businessPartners.length
                        : 0,
            },
            businessPartners: report,
            dateRange: {
                start,
                end,
            },
        };
    }

    // Analytics Trends (Time-series data)
    async getAnalyticsTrends(
        partnerId: string,
        metric: 'bookings' | 'revenue' | 'rating',
        dateRange: { start: Date; end: Date },
        period: 'daily' | 'weekly' | 'monthly' = 'weekly'
    ) {
        const partner = await prisma.servicePartner.findUnique({
            where: { id: partnerId },
        });

        if (!partner) {
            throw new NotFoundError('Partner not found');
        }

        const bookings = await prisma.booking.findMany({
            where: {
                partner_id: partnerId,
                created_at: {
                    gte: dateRange.start,
                    lte: dateRange.end,
                },
            },
            select: {
                created_at: true,
                total_amount: true,
                status: true,
            },
            orderBy: {
                created_at: 'asc',
            },
        });

        // Group by period
        const trends: any = {};
        bookings.forEach((booking) => {
            const date = new Date(booking.created_at);
            let key = '';

            switch (period) {
                case 'daily':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'weekly':
                    // Get week number
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split('T')[0];
                    break;
                case 'monthly':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
            }

            if (!trends[key]) {
                trends[key] = {
                    date: key,
                    bookings: 0,
                    revenue: 0,
                    completedBookings: 0,
                };
            }

            trends[key].bookings++;
            if (['COMPLETED', 'RATED'].includes(booking.status)) {
                trends[key].completedBookings++;
                trends[key].revenue += booking.total_amount;
            }
        });

        return {
            partnerId,
            metric,
            period,
            dateRange,
            data: Object.values(trends),
        };
    }
}

