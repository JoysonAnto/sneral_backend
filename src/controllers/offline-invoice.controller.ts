import { Request, Response, NextFunction } from 'express';
import { OfflineInvoiceService } from '../services/offline-invoice.service';
import { successResponse } from '../utils/response';

export class OfflineInvoiceController {
    private invoiceService: OfflineInvoiceService;

    constructor() {
        this.invoiceService = new OfflineInvoiceService();
    }

    getAllInvoices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const businessPartnerId = req.params.businessPartnerId;
            const result = await this.invoiceService.getAllInvoices(
                businessPartnerId,
                req.query
            );

            res.json(
                successResponse(
                    result.invoices,
                    'Invoices retrieved successfully',
                    result.pagination as any
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invoice = await this.invoiceService.getInvoiceById(req.params.id);
            res.json(successResponse(invoice, 'Invoice details retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createInvoice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const businessPartnerId = req.params.businessPartnerId;
            const invoice = await this.invoiceService.createInvoice(
                businessPartnerId,
                req.body
            );

            res.status(201).json(successResponse(invoice, 'Invoice created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateInvoice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invoice = await this.invoiceService.updateInvoice(
                req.params.id,
                req.body
            );

            res.json(successResponse(invoice, 'Invoice updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    sendInvoice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invoice = await this.invoiceService.sendInvoice(req.params.id);
            res.json(successResponse(invoice, 'Invoice sent successfully'));
        } catch (error) {
            next(error);
        }
    };

    recordPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.invoiceService.recordPayment(req.params.id, {
                ...req.body,
                created_by: req.user!.userId,
            });

            res.json(successResponse(result, 'Payment recorded successfully'));
        } catch (error) {
            next(error);
        }
    };

    cancelInvoice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invoice = await this.invoiceService.cancelInvoice(
                req.params.id,
                req.body.reason
            );

            res.json(successResponse(invoice, 'Invoice cancelled successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteInvoice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.invoiceService.deleteInvoice(req.params.id);
            res.json(successResponse(result, (result as any).message || 'Invoice deleted successfully'));
        } catch (error) {
            next(error);
        }
    };

    getInvoiceAnalytics = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const businessPartnerId = req.params.businessPartnerId;
            const { start_date, end_date } = req.query;

            const dateRange =
                start_date && end_date
                    ? { start: new Date(start_date as string), end: new Date(end_date as string) }
                    : undefined;

            const analytics = await this.invoiceService.getInvoiceAnalytics(
                businessPartnerId,
                dateRange
            );

            res.json(successResponse(analytics, 'Analytics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    markOverdueInvoices = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.invoiceService.markOverdueInvoices();
            res.json(successResponse(result, 'Overdue invoices updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    downloadInvoicePDF = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { pdfGeneratorService } = await import('../services/pdf-generator.service');
            const pdfBuffer = await pdfGeneratorService.generateInvoicePDF(req.params.id);

            // Get invoice for filename
            const invoice = await this.invoiceService.getInvoiceById(req.params.id);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="invoice-${invoice.invoice_number}.pdf"`
            );
            res.send(pdfBuffer);
        } catch (error) {
            next(error);
        }
    };
}
