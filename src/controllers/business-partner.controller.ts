import { Request, Response, NextFunction } from 'express';
import { BusinessPartnerService } from '../services/business-partner.service';
import { successResponse } from '../utils/response';

export class BusinessPartnerController {
    private bpService: BusinessPartnerService;

    constructor() {
        this.bpService = new BusinessPartnerService();
    }

    getUnifiedCustomers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const customers = await this.bpService.getUnifiedCustomers(req.params.id);
            res.json(successResponse(customers, 'Unified customers retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const analytics = await this.bpService.getBusinessAnalytics(req.params.id);
            res.json(successResponse(analytics, 'Business analytics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    generateSlots = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.bpService.generateDailySlots(
                req.params.id,
                new Date(req.body.date)
            );
            res.json(successResponse(result, 'Slots managed successfully'));
        } catch (error) {
            next(error);
        }
    };
}
