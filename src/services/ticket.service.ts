import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

export interface CreateTicketData {
    subject: string;
    description: string;
    category?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    userId?: string;
    bookingId?: string;
    partnerId?: string;
}

export interface UpdateTicketData {
    status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    category?: string;
    assignedTo?: string;
    resolutionNotes?: string;
}

export class TicketService {
    /**
     * Generate unique ticket number like TKT-20261101-ABCD
     */
    private generateTicketNumber(): string {
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        return `TKT-${datePart}-${randomPart}`;
    }

    /**
     * Create a new support ticket
     */
    async createTicket(data: CreateTicketData, creatorId?: string) {
        if (!data.subject || !data.description) {
            throw new BadRequestError('Subject and description are required');
        }

        const ticketNumber = this.generateTicketNumber();

        // If user logged in, find their profile/details if not provided
        let customerName = data.customerName;
        let customerEmail = data.customerEmail;
        let customerPhone = data.customerPhone;
        const targetUserId = data.userId || creatorId;

        if (targetUserId) {
            const user = await prisma.user.findUnique({
                where: { id: targetUserId },
            });
            if (user) {
                customerName = customerName || user.full_name;
                customerEmail = customerEmail || user.email;
                customerPhone = customerPhone || user.phone_number || undefined;
            }
        }

        const ticket = await prisma.ticket.create({
            data: {
                ticket_number: ticketNumber,
                subject: data.subject.trim(),
                description: data.description.trim(),
                category: data.category || 'GENERAL',
                priority: data.priority || 'MEDIUM',
                status: 'OPEN',
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                user_id: targetUserId || null,
                booking_id: data.bookingId || null,
                partner_id: data.partnerId || null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                        phone_number: true,
                        role: true,
                    },
                },
            },
        });

        logger.info(`Support ticket created: ${ticket.ticket_number}`);
        return ticket;
    }

    /**
     * Get all tickets with filtering and pagination
     */
    async getAllTickets(filters: any) {
        const { status, priority, category, search, page = 1, limit = 20 } = filters;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};

        if (status && status !== 'ALL') {
            where.status = status;
        }

        if (priority && priority !== 'ALL') {
            where.priority = priority;
        }

        if (category && category !== 'ALL') {
            where.category = category;
        }

        if (search) {
            where.OR = [
                { ticket_number: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { customer_name: { contains: search, mode: 'insensitive' } },
                { customer_email: { contains: search, mode: 'insensitive' } },
                { customer_phone: { contains: search } },
            ];
        }

        const [tickets, total] = await Promise.all([
            prisma.ticket.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                            phone_number: true,
                            role: true,
                        },
                    },
                },
            }),
            prisma.ticket.count({ where }),
        ]);

        return {
            tickets,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    }

    /**
     * Get ticket by ID
     */
    async getTicketById(id: string) {
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                        phone_number: true,
                        role: true,
                    },
                },
            },
        });

        if (!ticket) {
            throw new NotFoundError('Ticket not found');
        }

        return ticket;
    }

    /**
     * Update ticket status, resolution, or priority
     */
    async updateTicket(id: string, data: UpdateTicketData, adminName?: string) {
        const existing = await prisma.ticket.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Ticket not found');
        }

        const updatePayload: any = {};

        if (data.status) {
            updatePayload.status = data.status;
            if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
                updatePayload.resolved_at = new Date();
            } else if (data.status === 'OPEN' || data.status === 'IN_PROGRESS') {
                updatePayload.resolved_at = null;
            }
        }

        if (data.priority) {
            updatePayload.priority = data.priority;
        }

        if (data.category) {
            updatePayload.category = data.category;
        }

        if (data.assignedTo !== undefined) {
            updatePayload.assigned_to = data.assignedTo;
        }

        if (data.resolutionNotes !== undefined) {
            updatePayload.resolution_notes = data.resolutionNotes;
        }

        const updated = await prisma.ticket.update({
            where: { id },
            data: updatePayload,
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

        logger.info(`Ticket ${updated.ticket_number} updated to status ${updated.status} by ${adminName || 'Admin'}`);
        return updated;
    }

    /**
     * Delete ticket
     */
    async deleteTicket(id: string) {
        const existing = await prisma.ticket.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundError('Ticket not found');
        }

        await prisma.ticket.delete({ where: { id } });
        return { message: 'Ticket deleted successfully' };
    }

    /**
     * Generate Live Ticket Resolution Report / Stats
     */
    async getTicketStats() {
        const [total, open, inProgress, resolved, closed, urgent] = await Promise.all([
            prisma.ticket.count(),
            prisma.ticket.count({ where: { status: 'OPEN' } }),
            prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.ticket.count({ where: { status: 'RESOLVED' } }),
            prisma.ticket.count({ where: { status: 'CLOSED' } }),
            prisma.ticket.count({ where: { priority: 'URGENT', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        ]);

        const solvedCount = resolved + closed;
        const resolutionRate = total > 0 ? Math.round((solvedCount / total) * 100) : 100;

        return {
            total,
            open,
            inProgress,
            resolved,
            closed,
            urgent,
            solvedCount,
            unsolvedCount: open + inProgress,
            resolutionRate, // percentage
        };
    }
}

export default new TicketService();
