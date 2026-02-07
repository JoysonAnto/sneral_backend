import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';

export class BusinessPartnerService {
    /**
     * Get a unified view of all customers (online and offline) for a business partner
     */
    async getUnifiedCustomers(businessPartnerId: string) {
        const results = await Promise.all([
            prisma.offlineCustomer.findMany({
                where: { business_partner_id: businessPartnerId },
                orderBy: { created_at: 'desc' }
            }),
            prisma.booking.findMany({
                where: { business_partner_id: businessPartnerId } as any,
                include: {
                    customer: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                            phone_number: true,
                        }
                    }
                },
                orderBy: { scheduled_date: 'desc' }
            })
        ]);

        const offlineCustomers = results[0];
        const bookings = results[1] as any[];

        // Deduplicate and process online customers
        const onlineCustomersMap = new Map();
        bookings.forEach(booking => {
            const customer = booking.customer;
            if (!onlineCustomersMap.has(customer.id)) {
                onlineCustomersMap.set(customer.id, {
                    id: customer.id,
                    name: customer.full_name,
                    email: customer.email,
                    phone: customer.phone_number,
                    profileImage: (customer as any).profile_image,
                    type: 'ONLINE',
                    lastInteraction: booking.scheduled_date,
                    totalValue: booking.total_amount,
                    bookingCount: 1
                });
            } else {
                const existing = onlineCustomersMap.get(customer.id);
                existing.totalValue += booking.total_amount;
                existing.bookingCount += 1;
                if (new Date(booking.scheduled_date) > new Date(existing.lastInteraction)) {
                    existing.lastInteraction = booking.scheduled_date;
                }
            }
        });

        return {
            summary: {
                totalCustomers: offlineCustomers.length + onlineCustomersMap.size,
                onlineCount: onlineCustomersMap.size,
                offlineCount: offlineCustomers.length
            },
            online: Array.from(onlineCustomersMap.values()),
            offline: offlineCustomers.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.phone_number,
                type: 'OFFLINE',
                lastInteraction: (c as any).updated_at,
                totalValue: (c as any).total_revenue,
                outstanding: (c as any).outstanding_amount
            }))
        };
    }

    /**
     * Get analytics specifically for a business partner
     */
    async getBusinessAnalytics(businessPartnerId: string) {
        const bp = await prisma.businessPartner.findUnique({
            where: { id: businessPartnerId }
        });

        if (!bp) throw new NotFoundError('Business partner not found');

        const stats = await Promise.all([
            prisma.booking.aggregate({
                where: {
                    business_partner_id: businessPartnerId,
                    status: 'COMPLETED'
                } as any,
                _sum: { total_amount: true } as any,
                _count: true
            }),
            prisma.offlineInvoice.aggregate({
                where: {
                    business_partner_id: businessPartnerId,
                    status: 'PAID'
                } as any,
                _sum: { total_amount: true } as any,
                _count: true
            })
        ]);

        const onlineStats = stats[0];
        const offlineStats = stats[1];

        return {
            revenue: {
                online: (onlineStats._sum as any).total_amount || 0,
                offline: (offlineStats._sum as any).total_amount || 0,
                total: ((onlineStats._sum as any).total_amount || 0) + ((offlineStats._sum as any).total_amount || 0)
            },
            volumes: {
                onlineBookings: onlineStats._count,
                offlineInvoices: offlineStats._count
            },
            platformFeesPaid: ((onlineStats._sum as any).total_amount || 0) * (bp as any).commission_rate
        };
    }

    /**
     * Manage availability slots
     */
    async generateDailySlots(businessPartnerId: string, _date: Date) {
        // @ts-ignore - Prisma might not know about these new models immediately
        const businessHours = await prisma.businessHours.findMany({
            where: { business_partner_id: businessPartnerId, is_closed: false } as any
        });

        // Placeholder for slot generation logic
        return { message: 'Slots generation logic to be refined based on service average duration', businessHours };
    }
}
