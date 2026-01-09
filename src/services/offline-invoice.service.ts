import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { InvoiceStatus } from '@prisma/client';
import { OfflineCustomerService } from './offline-customer.service';

interface InvoiceItemData {
    service_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
}

interface CreateInvoiceData {
    customer_id: string;
    invoice_date: Date;
    due_date: Date;
    items: InvoiceItemData[];
    tax_rate?: number;
    discount_amount?: number;
    notes?: string;
    terms_conditions?: string;
    payment_instructions?: string;
}

interface RecordPaymentData {
    amount: number;
    payment_method: string;
    payment_date: Date;
    reference_number?: string;
    notes?: string;
    created_by: string;
}

export class OfflineInvoiceService {
    private customerService = new OfflineCustomerService();

    async generateInvoiceNumber() {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Get the last invoice for this month
        const lastInvoice = await prisma.offlineInvoice.findFirst({
            where: {
                invoice_number: {
                    startsWith: `INV-${yearMonth}-`,
                },
            },
            orderBy: {
                invoice_number: 'desc',
            },
        });

        let sequence = 1;
        if (lastInvoice) {
            const lastSequence = parseInt(lastInvoice.invoice_number.split('-')[2]);
            sequence = lastSequence + 1;
        }

        return `INV-${yearMonth}-${String(sequence).padStart(5, '0')}`;
    }

    async getAllInvoices(businessPartnerId: string, filters?: any) {
        const {
            search,
            status,
            customer_id,
            start_date,
            end_date,
            limit = 50,
            offset = 0,
        } = filters || {};

        const where: any = {
            business_partner_id: businessPartnerId,
        };

        if (search) {
            where.OR = [
                { invoice_number: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (status) {
            where.status = status;
        }

        if (customer_id) {
            where.customer_id = customer_id;
        }

        if (start_date || end_date) {
            where.invoice_date = {};
            if (start_date) where.invoice_date.gte = new Date(start_date);
            if (end_date) where.invoice_date.lte = new Date(end_date);
        }

        const [invoices, total] = await Promise.all([
            prisma.offlineInvoice.findMany({
                where,
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                    items: true,
                    _count: {
                        select: { payments: true },
                    },
                },
                orderBy: { created_at: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset),
            }),
            prisma.offlineInvoice.count({ where }),
        ]);

        return {
            invoices,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: total > parseInt(offset) + parseInt(limit),
            },
        };
    }

    async getInvoiceById(invoiceId: string) {
        const invoice = await prisma.offlineInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                customer: true,
                business_partner: {
                    select: {
                        id: true,
                        business_name: true,
                        gst_number: true,
                        user: {
                            select: {
                                email: true,
                                phone_number: true,
                            },
                        },
                    },
                },
                items: {
                    include: {
                        service: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                payments: {
                    orderBy: { payment_date: 'desc' },
                },
            },
        });

        if (!invoice) {
            throw new AppError('Invoice not found', 404);
        }

        return invoice;
    }

    async createInvoice(businessPartnerId: string, data: CreateInvoiceData) {
        // Validate customer belongs to this business partner
        const customer = await prisma.offlineCustomer.findFirst({
            where: {
                id: data.customer_id,
                business_partner_id: businessPartnerId,
            },
        });

        if (!customer) {
            throw new AppError('Customer not found or does not belong to this business', 404);
        }

        // Generate invoice number
        const invoice_number = await this.generateInvoiceNumber();

        // Calculate amounts
        const subtotal = data.items.reduce((sum, item) => {
            return sum + item.quantity * item.unit_price;
        }, 0);

        const tax_rate = data.tax_rate || 0;
        const tax_amount = (subtotal * tax_rate) / 100;
        const discount_amount = data.discount_amount || 0;
        const total_amount = subtotal + tax_amount - discount_amount;

        // Create invoice with items
        const invoice = await prisma.offlineInvoice.create({
            data: {
                invoice_number,
                business_partner_id: businessPartnerId,
                customer_id: data.customer_id,
                invoice_date: new Date(data.invoice_date),
                due_date: new Date(data.due_date),
                subtotal,
                tax_rate,
                tax_amount,
                discount_amount,
                total_amount,
                balance_amount: total_amount,
                notes: data.notes,
                terms_conditions: data.terms_conditions,
                payment_instructions: data.payment_instructions,
                items: {
                    create: data.items.map((item) => ({
                        service_id: item.service_id,
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.quantity * item.unit_price,
                    })),
                },
            },
            include: {
                items: true,
                customer: true,
            },
        });

        // Update customer totals
        await this.customerService.updateCustomerTotals(data.customer_id);

        return invoice;
    }

    async updateInvoice(invoiceId: string, data: Partial<CreateInvoiceData>) {
        const existingInvoice = await this.getInvoiceById(invoiceId);

        // Only allow updating draft invoices
        if (existingInvoice.status !== 'DRAFT') {
            throw new AppError('Only draft invoices can be updated', 400);
        }

        let updateData: any = {
            invoice_date: data.invoice_date ? new Date(data.invoice_date) : undefined,
            due_date: data.due_date ? new Date(data.due_date) : undefined,
            notes: data.notes,
            terms_conditions: data.terms_conditions,
            payment_instructions: data.payment_instructions,
        };

        // If items are being updated, recalculate amounts
        if (data.items) {
            const subtotal = data.items.reduce((sum, item) => {
                return sum + item.quantity * item.unit_price;
            }, 0);

            const tax_rate = data.tax_rate ?? existingInvoice.tax_rate;
            const tax_amount = (subtotal * tax_rate) / 100;
            const discount_amount = data.discount_amount ?? existingInvoice.discount_amount;
            const total_amount = subtotal + tax_amount - discount_amount;

            updateData = {
                ...updateData,
                subtotal,
                tax_rate,
                tax_amount,
                discount_amount,
                total_amount,
                balance_amount: total_amount - existingInvoice.paid_amount,
            };

            // Delete old items and create new ones
            await prisma.offlineInvoiceItem.deleteMany({
                where: { invoice_id: invoiceId },
            });

            updateData.items = {
                create: data.items.map((item) => ({
                    service_id: item.service_id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.quantity * item.unit_price,
                })),
            };
        }

        const invoice = await prisma.offlineInvoice.update({
            where: { id: invoiceId },
            data: updateData,
            include: {
                items: true,
                customer: true,
            },
        });

        // Update customer totals
        await this.customerService.updateCustomerTotals(invoice.customer_id);

        return invoice;
    }

    async sendInvoice(invoiceId: string) {
        const invoice = await this.getInvoiceById(invoiceId);

        if (invoice.status !== 'DRAFT') {
            throw new AppError('Only draft invoices can be sent', 400);
        }

        // Check if customer has email
        if (!invoice.customer.email) {
            throw new AppError('Customer does not have an email address', 400);
        }

        // Generate PDF
        const { pdfGeneratorService } = await import('./pdf-generator.service');
        const pdfBuffer = await pdfGeneratorService.generateInvoicePDF(invoiceId);

        // Send email with PDF
        const { EmailService } = await import('./email.service');
        const emailService = new EmailService();
        await emailService.sendInvoiceEmail(invoice.customer.email, invoice, pdfBuffer);

        // Update invoice status
        const updatedInvoice = await prisma.offlineInvoice.update({
            where: { id: invoiceId },
            data: {
                status: InvoiceStatus.SENT,
                sent_at: new Date(),
            },
            include: {
                items: true,
                customer: true,
            },
        });

        return updatedInvoice;
    }

    async recordPayment(invoiceId: string, paymentData: RecordPaymentData) {
        const invoice = await this.getInvoiceById(invoiceId);

        if (invoice.status === 'CANCELLED' || invoice.status === 'PAID') {
            throw new AppError('Cannot record payment for this invoice', 400);
        }

        if (paymentData.amount <= 0) {
            throw new AppError('Payment amount must be greater than 0', 400);
        }

        if (paymentData.amount > invoice.balance_amount) {
            throw new AppError('Payment amount exceeds outstanding balance', 400);
        }

        // Record payment
        const payment = await prisma.offlinePayment.create({
            data: {
                invoice_id: invoiceId,
                amount: paymentData.amount,
                payment_method: paymentData.payment_method as any,
                payment_date: new Date(paymentData.payment_date),
                reference_number: paymentData.reference_number,
                notes: paymentData.notes,
                created_by: paymentData.created_by,
            },
        });

        // Update invoice amounts
        const new_paid_amount = invoice.paid_amount + paymentData.amount;
        const new_balance = invoice.total_amount - new_paid_amount;

        let new_status: InvoiceStatus = invoice.status;
        if (new_balance === 0) {
            new_status = InvoiceStatus.PAID;
        } else if (new_paid_amount > 0) {
            new_status = InvoiceStatus.PARTIALLY_PAID;
        }

        const updatedInvoice = await prisma.offlineInvoice.update({
            where: { id: invoiceId },
            data: {
                paid_amount: new_paid_amount,
                balance_amount: new_balance,
                status: new_status,
                paid_at: new_balance === 0 ? new Date() : null,
            },
            include: {
                customer: true,
                items: true,
                payments: true,
            },
        });

        // Update customer totals
        await this.customerService.updateCustomerTotals(invoice.customer_id);

        return { invoice: updatedInvoice, payment };
    }

    async cancelInvoice(invoiceId: string, reason: string) {
        const invoice = await this.getInvoiceById(invoiceId);

        if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
            throw new AppError('Cannot cancel this invoice', 400);
        }

        if (invoice.paid_amount > 0) {
            throw new AppError('Cannot cancel invoice with recorded payments', 400);
        }

        const updatedInvoice = await prisma.offlineInvoice.update({
            where: { id: invoiceId },
            data: {
                status: InvoiceStatus.CANCELLED,
                cancelled_at: new Date(),
                cancellation_reason: reason,
            },
            include: {
                customer: true,
                items: true,
            },
        });

        // Update customer totals
        await this.customerService.updateCustomerTotals(invoice.customer_id);

        return updatedInvoice;
    }

    async deleteInvoice(invoiceId: string) {
        const invoice = await this.getInvoiceById(invoiceId);

        // Only allow deleting draft invoices
        if (invoice.status !== 'DRAFT') {
            throw new AppError('Only draft invoices can be deleted', 400);
        }

        await prisma.offlineInvoice.delete({
            where: { id: invoiceId },
        });

        // Update customer totals
        await this.customerService.updateCustomerTotals(invoice.customer_id);

        return { message: 'Invoice deleted successfully' };
    }

    async getInvoiceAnalytics(businessPartnerId: string, dateRange?: { start: Date; end: Date }) {
        const where: any = {
            business_partner_id: businessPartnerId,
        };

        if (dateRange) {
            where.invoice_date = {
                gte: dateRange.start,
                lte: dateRange.end,
            };
        }

        const [statusBreakdown, totals, recentInvoices] = await Promise.all([
            prisma.offlineInvoice.groupBy({
                by: ['status'],
                where,
                _count: true,
                _sum: {
                    total_amount: true,
                    paid_amount: true,
                    balance_amount: true,
                },
            }),
            prisma.offlineInvoice.aggregate({
                where,
                _count: true,
                _sum: {
                    total_amount: true,
                    paid_amount: true,
                    balance_amount: true,
                },
            }),
            prisma.offlineInvoice.findMany({
                where: {
                    ...where,
                    status: InvoiceStatus.OVERDUE,
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { due_date: 'asc' },
                take: 10,
            }),
        ]);

        return {
            total_invoices: totals._count,
            total_amount: totals._sum.total_amount || 0,
            total_paid: totals._sum.paid_amount || 0,
            total_outstanding: totals._sum.balance_amount || 0,
            by_status: statusBreakdown,
            overdue_invoices: recentInvoices,
        };
    }

    async markOverdueInvoices() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await prisma.offlineInvoice.updateMany({
            where: {
                status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
                due_date: { lt: today },
            },
            data: {
                status: InvoiceStatus.OVERDUE,
            },
        });

        return { updated: result.count };
    }
}

export const offlineInvoiceService = new OfflineInvoiceService();
