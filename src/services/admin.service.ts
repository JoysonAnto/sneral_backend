import prisma from '../config/database';

export class AdminService {
    async getDashboardStats() {
        const [
            totalUsers,
            totalPartners,
            totalBookings,
            activeBookings,
            pendingKYC,
            todayBookings,
            monthlyRevenue,
        ] = await Promise.all([
            // Total users
            prisma.user.count(),

            // Total partners (service + business)
            Promise.all([
                prisma.servicePartner.count(),
                prisma.businessPartner.count(),
            ]).then(([sp, bp]) => sp + bp),

            // Total bookings
            prisma.booking.count(),

            // Active bookings
            prisma.booking.count({
                where: {
                    status: {
                        in: ['SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_ACCEPTED', 'IN_PROGRESS'],
                    },
                },
            }),

            // Pending KYC
            prisma.servicePartner.count({
                where: {
                    kyc_status: 'PENDING_VERIFICATION',
                },
            }),

            // Today's bookings
            prisma.booking.count({
                where: {
                    created_at: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),

            // Monthly revenue (completed bookings this month)
            prisma.booking.aggregate({
                where: {
                    status: { in: ['COMPLETED', 'RATED'] },
                    completed_at: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                },
                _sum: {
                    total_amount: true,
                },
            }),
        ]);

        // Get top services
        const topServices = await prisma.bookingItem.groupBy({
            by: ['service_id'],
            _count: {
                service_id: true,
            },
            orderBy: {
                _count: {
                    service_id: 'desc',
                },
            },
            take: 5,
        });

        const topServicesWithNames = await Promise.all(
            topServices.map(async (item) => {
                const service = await prisma.service.findUnique({
                    where: { id: item.service_id },
                    select: { name: true },
                });
                return {
                    name: service?.name || 'Unknown',
                    bookings: item._count.service_id,
                };
            })
        );

        // Calculate today's revenue (today's completed bookings)
        const todayRevenue = await prisma.booking.aggregate({
            where: {
                status: { in: ['COMPLETED', 'RATED'] },
                completed_at: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
            _sum: {
                total_amount: true,
            },
        });

        return {
            totalUsers,
            totalPartners,
            totalBookings,
            activeBookings,
            todayBookings,
            todayRevenue: todayRevenue._sum.total_amount || 0,
            monthlyRevenue: monthlyRevenue._sum.total_amount || 0,
            pendingKYC,
            topServices: topServicesWithNames,
        };
    }

    async generateReport(type: string, startDate?: string, endDate?: string) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        switch (type) {
            case 'REVENUE':
                return await this.getRevenueReport(start, end);
            case 'BOOKINGS':
                return await this.getBookingsReport(start, end);
            case 'PARTNERS':
                return await this.getPartnersReport(start, end);
            default:
                throw new Error('Invalid report type');
        }
    }

    private async getRevenueReport(startDate: Date, endDate: Date) {
        const bookings = await prisma.booking.findMany({
            where: {
                status: { in: ['COMPLETED', 'RATED'] },
                completed_at: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                total_amount: true,
                completed_at: true,
            },
        });

        const totalRevenue = bookings.reduce((sum, b) => sum + b.total_amount, 0);
        const avgBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0;

        return {
            type: 'REVENUE',
            startDate,
            endDate,
            totalRevenue,
            totalBookings: bookings.length,
            avgBookingValue,
        };
    }

    private async getBookingsReport(startDate: Date, endDate: Date) {
        const bookings = await prisma.booking.groupBy({
            by: ['status'],
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _count: {
                status: true,
            },
        });

        return {
            type: 'BOOKINGS',
            startDate,
            endDate,
            byStatus: bookings.map(b => ({
                status: b.status,
                count: b._count.status,
            })),
        };
    }

    private async getPartnersReport(startDate: Date, endDate: Date) {
        const [newPartners, totalBookingsByPartners] = await Promise.all([
            prisma.servicePartner.count({
                where: {
                    created_at: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            }),
            prisma.servicePartner.findMany({
                select: {
                    id: true,
                    user: {
                        select: {
                            full_name: true,
                        },
                    },
                    total_bookings: true,
                    completed_bookings: true,
                    avg_rating: true,
                },
                orderBy: {
                    total_bookings: 'desc',
                },
                take: 10,
            }),
        ]);

        return {
            type: 'PARTNERS',
            startDate,
            endDate,
            newPartners,
            topPartners: totalBookingsByPartners.map(p => ({
                name: p.user.full_name,
                totalBookings: p.total_bookings,
                completedBookings: p.completed_bookings,
                avgRating: p.avg_rating,
            })),
        };
    }

    async getPendingPartners() {
        const [pendingServicePartners, pendingBusinessPartners] = await Promise.all([
            prisma.servicePartner.findMany({
                where: { kyc_status: 'PENDING_VERIFICATION' },
                include: {
                    user: {
                        select: {
                            full_name: true,
                            email: true,
                            phone_number: true,
                        }
                    },
                    kyc_documents: true,
                }
            }),
            prisma.businessPartner.findMany({
                where: { kyc_status: 'PENDING_VERIFICATION' },
                include: {
                    user: {
                        select: {
                            full_name: true,
                            email: true,
                            phone_number: true,
                        }
                    },
                    kyc_documents: true,
                }
            }),
        ]);

        return {
            servicePartners: pendingServicePartners,
            businessPartners: pendingBusinessPartners,
        };
    }

    async approvePartner(partnerId: string, partnerType: 'SERVICE' | 'BUSINESS') {
        if (partnerType === 'SERVICE') {
            return await prisma.servicePartner.update({
                where: { id: partnerId },
                data: {
                    kyc_status: 'APPROVED',
                    kyc_verified_at: new Date(),
                }
            });
        } else {
            return await prisma.businessPartner.update({
                where: { id: partnerId },
                data: {
                    kyc_status: 'APPROVED',
                    kyc_verified_at: new Date(),
                }
            });
        }
    }

    async rejectPartner(partnerId: string, partnerType: 'SERVICE' | 'BUSINESS', _reason: string) {
        if (partnerType === 'SERVICE') {
            return await prisma.servicePartner.update({
                where: { id: partnerId },
                data: {
                    kyc_status: 'REJECTED',
                }
            });
        } else {
            return await prisma.businessPartner.update({
                where: { id: partnerId },
                data: {
                    kyc_status: 'REJECTED',
                }
            });
        }
    }

    async createCategory(data: any) {
        return await prisma.category.create({
            data: {
                name: data.name,
                description: data.description,
                icon_url: data.icon_url,
                display_order: data.display_order || 0,
            }
        });
    }

    async updateCategory(id: string, data: any) {
        return await prisma.category.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                icon_url: data.icon_url,
                display_order: data.display_order,
                is_active: data.is_active,
            }
        });
    }

    async togglePartnerStatus(partnerId: string, partnerType: 'SERVICE' | 'BUSINESS', isActive: boolean) {
        let userId: string | undefined;

        if (partnerType === 'SERVICE') {
            const partner = await prisma.servicePartner.findUnique({ where: { id: partnerId } });
            userId = partner?.user_id;
        } else {
            const partner = await prisma.businessPartner.findUnique({ where: { id: partnerId } });
            userId = partner?.user_id;
        }

        if (!userId) throw new Error('Partner not found');

        return await prisma.user.update({
            where: { id: userId },
            data: { is_active: isActive }
        });
    }
}
