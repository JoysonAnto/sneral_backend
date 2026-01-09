import { Request, Response, NextFunction } from 'express';
import { OfflineCustomerService } from '../services/offline-customer.service';
import { successResponse } from '../utils/response';

export class OfflineCustomerController {
    private customerService: OfflineCustomerService;

    constructor() {
        this.customerService = new OfflineCustomerService();
    }

    getAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const businessPartnerId = req.params.businessPartnerId;
            const result = await this.customerService.getAllCustomers(
                businessPartnerId,
                req.query
            );

            res.json(
                successResponse(
                    result.customers,
                    'Customers retrieved successfully',
                    {
                        page: Math.floor((result.pagination.offset || 0) / (result.pagination.limit || 10)) + 1,
                        limit: result.pagination.limit,
                        total: result.pagination.total
                    }
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const customer = await this.customerService.getCustomerById(req.params.id);
            res.json(successResponse(customer, 'Customer details retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createCustomer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const businessPartnerId = req.params.businessPartnerId;
            const customer = await this.customerService.createCustomer(
                businessPartnerId,
                req.body
            );

            res.status(201).json(successResponse(customer, 'Customer created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const customer = await this.customerService.updateCustomer(
                req.params.id,
                req.body
            );

            res.json(successResponse(customer, 'Customer updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.customerService.deleteCustomer(req.params.id);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    getCustomerStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const stats = await this.customerService.getCustomerStats(req.params.id);
            res.json(successResponse(stats, 'Customer statistics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };
}
