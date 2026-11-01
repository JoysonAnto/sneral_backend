import { Request, Response } from 'express';
import ticketService from '../services/ticket.service';
import { asyncHandler } from '../middleware/async.middleware';

export class TicketController {
    getAllTickets = asyncHandler(async (req: Request, res: Response) => {
        const result = await ticketService.getAllTickets(req.query);
        res.status(200).json({
            success: true,
            data: result.tickets,
            pagination: result.pagination,
        });
    });

    getTicketStats = asyncHandler(async (_req: Request, res: Response) => {
        const stats = await ticketService.getTicketStats();
        res.status(200).json({
            success: true,
            data: stats,
        });
    });

    getTicketById = asyncHandler(async (req: Request, res: Response) => {
        const ticket = await ticketService.getTicketById(req.params.id);
        res.status(200).json({
            success: true,
            data: ticket,
        });
    });

    createTicket = asyncHandler(async (req: Request, res: Response) => {
        const creatorId = (req as any).user?.userId;
        const ticket = await ticketService.createTicket(req.body, creatorId);
        res.status(201).json({
            success: true,
            message: 'Support ticket created successfully',
            data: ticket,
        });
    });

    updateTicket = asyncHandler(async (req: Request, res: Response) => {
        const adminName = (req as any).user?.email || (req as any).user?.fullName;
        const ticket = await ticketService.updateTicket(req.params.id, req.body, adminName);
        res.status(200).json({
            success: true,
            message: 'Support ticket updated successfully',
            data: ticket,
        });
    });

    deleteTicket = asyncHandler(async (req: Request, res: Response) => {
        const result = await ticketService.deleteTicket(req.params.id);
        res.status(200).json({
            success: true,
            message: result.message,
        });
    });
}

export default new TicketController();
