import prisma from '../config/database';

export class RecurringInvoiceService {
    async createRecurringInvoice(businessPartnerId: string, data: any) {
        const {
            customer_id,
            template_name,
            frequency,
            interval = 1,
            start_date,
            end_date,
            max_occurrences,
            items,
            ...invoiceData
        } = data;

        // Calculate next invoice date
        const startDate = new Date(start_date);
        const nextInvoiceDate = this.calculateNextDate(startDate, frequency, interval);

        const recurring = await prisma.recurringInvoice.create({
            data: {
                business_partner_id: businessPartnerId,
                customer_id,
                template_name,
                frequency,
                interval,
                start_date: startDate,
                end_date: end_date ? new Date(end_date) : null,
                max_occurrences,
                next_invoice_date: nextInvoiceDate,
                status: 'ACTIVE',
                created_by: businessPartnerId,
                ...invoiceData,
                items: {
                    create: items.map((item: any) => ({
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

        return recurring;
    }

    async getAllRecurringInvoices(businessPartnerId: string, filters: any = {}) {
        const { status, customer_id, frequency } = filters;

        const where: any = { business_partner_id: businessPartnerId };
        if (status) where.status = status;
        if (customer_id) where.customer_id = customer_id;
        if (frequency) where.frequency = frequency;

        const recurring = await prisma.recurringInvoice.findMany({
            where,
            include: {
                customer: true,
                items: true,
                _count: {
                    select: { generated_invoices: true },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        return recurring;
    }

    async getRecurringInvoiceById(id: string) {
        const recurring = await prisma.recurringInvoice.findUnique({
            where: { id },
            include: {
                customer: true,
                items: true,
                generated_invoices: {
                    orderBy: { invoice_date: 'desc' },
                    take: 10,
                },
            },
        });

        if (!recurring) {
            throw new Error('Recurring invoice not found');
        }

        return recurring;
    }

    async updateRecurringInvoice(id: string, data: any) {
        const { items, ...updateData } = data;

        const recurring = await prisma.recurringInvoice.update({
            where: { id },
            data: {
                ...updateData,
                ...(items && {
                    items: {
                        deleteMany: {},
                        create: items.map((item: any) => ({
                            service_id: item.service_id,
                            description: item.description,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total_price: item.quantity * item.unit_price,
                        })),
                    },
                }),
            },
            include: {
                items: true,
                customer: true,
            },
        });

        return recurring;
    }

    async pauseRecurringInvoice(id: string) {
        return await prisma.recurringInvoice.update({
            where: { id },
            data: { status: 'PAUSED' },
        });
    }

    async resumeRecurringInvoice(id: string) {
        return await prisma.recurringInvoice.update({
            where: { id },
            data: { status: 'ACTIVE' },
        });
    }

    async cancelRecurringInvoice(id: string) {
        return await prisma.recurringInvoice.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
    }

    async deleteRecurringInvoice(id: string) {
        await prisma.recurringInvoice.delete({
            where: { id },
        });

        return { message: 'Recurring invoice deleted successfully' };
    }

    // Auto-generation logic
    async generateDueInvoices() {
        const now = new Date();

        // Find all active recurring invoices that are due
        const dueRecurring = await prisma.recurringInvoice.findMany({
            where: {
                status: 'ACTIVE',
                next_invoice_date: {
                    lte: now,
                },
            },
            include: {
                items: true,
                customer: true,
                business_partner: true,
            },
        });

        const results = [];

        for (const recurring of dueRecurring) {
            try {
                // Check if max occurrences reached
                if (recurring.max_occurrences && recurring.occurrences_count >= recurring.max_occurrences) {
                    await prisma.recurringInvoice.update({
                        where: { id: recurring.id },
                        data: { status: 'EXPIRED' },
                    });
                    continue;
                }

                // Check if end date reached
                if (recurring.end_date && now > recurring.end_date) {
                    await prisma.recurringInvoice.update({
                        where: { id: recurring.id },
                        data: { status: 'EXPIRED' },
                    });
                    continue;
                }

                // Generate invoice
                const invoiceNumber = await this.generateInvoiceNumber(recurring.business_partner_id);
                const dueDate = new Date(now);
                dueDate.setDate(dueDate.getDate() + 30); // 30 days payment term

                const invoice = await prisma.offlineInvoice.create({
                    data: {
                        invoice_number: invoiceNumber,
                        business_partner_id: recurring.business_partner_id,
                        customer_id: recurring.customer_id,
                        recurring_invoice_id: recurring.id,
                        invoice_date: now,
                        due_date: dueDate,
                        subtotal: recurring.subtotal,
                        tax_rate: recurring.tax_rate,
                        tax_amount: recurring.tax_amount,
                        discount_amount: recurring.discount_amount,
                        total_amount: recurring.total_amount,
                        paid_amount: 0,
                        balance_amount: recurring.total_amount,
                        status: 'SENT',
                        notes: recurring.notes,
                        terms_conditions: recurring.terms_conditions,
                        payment_instructions: recurring.payment_instructions,
                        sent_at: now,
                        items: {
                            create: recurring.items.map((item) => ({
                                service_id: item.service_id,
                                description: item.description,
                                quantity: item.quantity,
                                unit_price: item.unit_price,
                                total_price: item.total_price,
                            })),
                        },
                    },
                });

                // Update recurring invoice
                const nextDate = this.calculateNextDate(
                    recurring.next_invoice_date,
                    recurring.frequency,
                    recurring.interval
                );

                await prisma.recurringInvoice.update({
                    where: { id: recurring.id },
                    data: {
                        last_generated_date: now,
                        next_invoice_date: nextDate,
                        occurrences_count: recurring.occurrences_count + 1,
                    },
                });

                results.push({
                    recurring_id: recurring.id,
                    invoice_id: invoice.id,
                    invoice_number: invoiceNumber,
                    status: 'generated',
                });
            } catch (error) {
                results.push({
                    recurring_id: recurring.id,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return {
            total_processed: dueRecurring.length,
            results,
        };
    }

    private calculateNextDate(currentDate: Date, frequency: string, interval: number): Date {
        const next = new Date(currentDate);

        switch (frequency) {
            case 'DAILY':
                next.setDate(next.getDate() + interval);
                break;
            case 'WEEKLY':
                next.setDate(next.getDate() + interval * 7);
                break;
            case 'MONTHLY':
                next.setMonth(next.getMonth() + interval);
                break;
            case 'QUARTERLY':
                next.setMonth(next.getMonth() + interval * 3);
                break;
            case 'YEARLY':
                next.setFullYear(next.getFullYear() + interval);
                break;
        }

        return next;
    }

    private async generateInvoiceNumber(businessPartnerId: string): Promise<string> {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `INV-${year}${month}`;

        const lastInvoice = await prisma.offlineInvoice.findFirst({
            where: {
                business_partner_id: businessPartnerId,
                invoice_number: {
                    startsWith: prefix,
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

        return `${prefix}-${String(sequence).padStart(5, '0')}`;
    }
}

export const recurringInvoiceService = new RecurringInvoiceService();
