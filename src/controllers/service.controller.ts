import { Request, Response, NextFunction } from 'express';
import { ServiceService } from '../services/service.service';
import { successResponse } from '../utils/response';

export class ServiceController {
    private serviceService: ServiceService;

    constructor() {
        this.serviceService = new ServiceService();
    }

    // Services
    getAllServices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.serviceService.getAllServices(req.query);
            res.json(
                successResponse(
                    result.services,
                    'Services retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getServiceById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const service = await this.serviceService.getServiceById(req.params.id);
            res.json(successResponse(service, 'Service retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createService = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const service = await this.serviceService.createService(req.body);
            res.status(201).json(successResponse(service, 'Service created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateService = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const service = await this.serviceService.updateService(
                req.params.id,
                req.body
            );
            res.json(successResponse(service, 'Service updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteService = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.serviceService.deleteService(req.params.id);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    // Categories
    getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const categories = await this.serviceService.getAllCategories();
            res.json(successResponse(categories, 'Categories retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createCategory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const category = await this.serviceService.createCategory(req.body);
            res.status(201).json(successResponse(category, 'Category created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateCategory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const category = await this.serviceService.updateCategory(
                req.params.id,
                req.body
            );
            res.json(successResponse(category, 'Category updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Location-based Pricing
    getServiceWithLocationPricing = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const service = await this.serviceService.getServiceWithLocationPricing(req.params.id);
            res.json(successResponse(service, 'Service with location pricing retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    setLocationPricing = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const pricing = await this.serviceService.setLocationPricing(
                req.params.id,
                req.body
            );
            res.status(201).json(successResponse(pricing, 'Location pricing set successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteLocationPricing = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.serviceService.deleteLocationPricing(
                req.params.id,
                req.params.pricingId
            );
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    getServicePrice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { stateId, districtId, areaId } = req.query;
            const priceInfo = await this.serviceService.getServicePrice(
                req.params.id,
                {
                    stateId: stateId as string | undefined,
                    districtId: districtId as string | undefined,
                    areaId: areaId as string | undefined,
                }
            );
            res.json(successResponse(priceInfo, 'Service price retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };
}

