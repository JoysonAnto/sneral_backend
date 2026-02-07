import prisma from '../config/database';
import { AppError } from '../utils/errors';

interface CreateCustomerData {
    name: string;
    email?: string;
    phone_number: string;
    alternate_phone?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    company_name?: string;
    gst_number?: string;
    notes?: string;
}

interface UpdateCustomerData extends Partial<CreateCustomerData> {
    is_active?: boolean;
}

export class OfflineCustomerService {
    async getAllCustomers(businessPartnerId: string, filters?: any) {
        const { search, is_active, limit = 50, offset = 0 } = filters || {};

        const where: any = {
            business_partner_id: businessPartnerId,
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone_number: { contains: search } },
                { company_name: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (is_active !== undefined) {
            where.is_active = is_active === 'true' || is_active === true;
        }

        const [customers, total] = await Promise.all([
            prisma.offlineCustomer.findMany({
                where,
                include: {
                    _count: {
                        select: { invoices: true },
                    },
                },
                orderBy: { created_at: 'desc' },
                take: Number(limit),
                skip: Number(offset),
            }),
            prisma.offlineCustomer.count({ where }),
        ]);

        return {
            customers,
            pagination: {
                total,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: total > Number(offset) + Number(limit),
            },
        };
    }

    async getCustomerById(customerId: string) {
        const customer = await prisma.offlineCustomer.findUnique({
            where: { id: customerId },
            include: {
                invoices: {
                    orderBy: { created_at: 'desc' },
                    take: 10,
                },
                _count: {
                    select: { invoices: true },
                },
            },
        });

        if (!customer) {
            throw new AppError('Customer not found', 404);
        }

        return customer;
    }

    async createCustomer(businessPartnerId: string, data: CreateCustomerData) {
        // Check for duplicate phone number within the same business partner
        const existing = await prisma.offlineCustomer.findFirst({
            where: {
                business_partner_id: businessPartnerId,
                phone_number: data.phone_number,
            },
        });

        if (existing) {
            throw new AppError('Customer with this phone number already exists', 400);
        }

        const customer = await prisma.offlineCustomer.create({
            data: {
                ...data,
                business_partner_id: businessPartnerId,
            },
        });

        return customer;
    }

    async updateCustomer(customerId: string, data: UpdateCustomerData) {
        const customer = await prisma.offlineCustomer.update({
            where: { id: customerId },
            data,
        });

        return customer;
    }

    async deleteCustomer(customerId: string) {
        // Check if customer has any invoices
        const invoiceCount = await prisma.offlineInvoice.count({
            where: { customer_id: customerId },
        });

        if (invoiceCount > 0) {
            throw new AppError(
                'Cannot delete customer with existing invoices. Set as inactive instead.',
                400
            );
        }

        await prisma.offlineCustomer.delete({
            where: { id: customerId },
        });

        return { message: 'Customer deleted successfully' };
    }

    async getCustomerStats(customerId: string) {
        const customer = await this.getCustomerById(customerId);

        const [invoiceStats, recentInvoices] = await Promise.all([
            prisma.offlineInvoice.groupBy({
                by: ['status'],
                where: { customer_id: customerId },
                _count: true,
                _sum: {
                    total_amount: true,
                    paid_amount: true,
                    balance_amount: true,
                },
            }),
            prisma.offlineInvoice.findMany({
                where: { customer_id: customerId },
                orderBy: { created_at: 'desc' },
                take: 5,
                select: {
                    id: true,
                    invoice_number: true,
                    status: true,
                    total_amount: true,
                    balance_amount: true,
                    invoice_date: true,
                    due_date: true,
                },
            }),
        ]);

        // Calculate stats
        const stats = {
            total_invoices: customer.total_invoices,
            total_revenue: customer.total_revenue,
            outstanding_amount: customer.outstanding_amount,
            paid_invoices: invoiceStats.find((s) => s.status === 'PAID')?._count || 0,
            overdue_invoices: invoiceStats.find((s) => s.status === 'OVERDUE')?._count || 0,
            draft_invoices: invoiceStats.find((s) => s.status === 'DRAFT')?._count || 0,
        };

        return {
            customer,
            stats,
            recent_invoices: recentInvoices,
        };
    }

    async updateCustomerTotals(customerId: string) {
        const aggregates = await prisma.offlineInvoice.aggregate({
            where: {
                customer_id: customerId,
                status: { notIn: ['DRAFT', 'CANCELLED'] },
            },
            _count: true,
            _sum: {
                total_amount: true,
                balance_amount: true,
            },
        });

        await prisma.offlineCustomer.update({
            where: { id: customerId },
            data: {
                total_invoices: aggregates._count,
                total_revenue: aggregates._sum.total_amount || 0,
                outstanding_amount: aggregates._sum.balance_amount || 0,
            },
        });
    }
}
