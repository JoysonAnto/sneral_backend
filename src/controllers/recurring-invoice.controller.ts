import { Request, Response, NextFunction } from 'express';
import { RecurringInvoiceService } from '../services/recurring-invoice.service';
import { successResponse } from '../utils/response';

export class RecurringInvoiceController {
    private recurringService: RecurringInvoiceService;

    constructor() {
        this.recurringService = new RecurringInvoiceService();
    }

    createRecurring = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const businessPartnerId = req.params.businessPartnerId;
            const recurring = await this.recurringService.createRecurringInvoice(
                businessPartnerId,
                req.body
            );

            res.status(201).json(successResponse(recurring, 'Recurring invoice created successfully'));
        } catch (error) {
            next(error);
        }
    };

    getAllRecurring = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const businessPartnerId = req.params.businessPartnerId;
            const recurring = await this.recurringService.getAllRecurringInvoices(
                businessPartnerId,
                req.query
            );

            res.json(successResponse(recurring, 'Recurring invoices retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getRecurringById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const recurring = await this.recurringService.getRecurringInvoiceById(req.params.id);
            res.json(successResponse(recurring, 'Recurring invoice details retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateRecurring = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const recurring = await this.recurringService.updateRecurringInvoice(
                req.params.id,
                req.body
            );

            res.json(successResponse(recurring, 'Recurring invoice updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    pauseRecurring = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const recurring = await this.recurringService.pauseRecurringInvoice(req.params.id);
            res.json(successResponse(recurring, 'Recurring invoice paused successfully'));
        } catch (error) {
            next(error);
        }
    };

    resumeRecurring = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const recurring = await this.recurringService.resumeRecurringInvoice(req.params.id);
            res.json(successResponse(recurring, 'Recurring invoice resumed successfully'));
        } catch (error) {
            next(error);
        }
    };

    cancelRecurring = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const recurring = await this.recurringService.cancelRecurringInvoice(req.params.id);
            res.json(successResponse(recurring, 'Recurring invoice cancelled successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteRecurring = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.recurringService.deleteRecurringInvoice(req.params.id);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    generateInvoices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.recurringService.generateDueInvoices();
            res.json(successResponse(result, 'Invoice generation completed'));
        } catch (error) {
            next(error);
        }
    };
}
