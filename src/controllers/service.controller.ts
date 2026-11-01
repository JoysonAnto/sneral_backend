import { Request, Response, NextFunction } from 'express';
import { ServiceService } from '../services/service.service';
import { successResponse } from '../utils/response';
import CloudinaryService from '../services/cloudinary.service';
import { sanitizeServiceNote } from '../utils/sanitize';

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
            let imageUrl = req.body.imageUrl || req.body.image_url;

            // If file uploaded, upload to Cloudinary
            if (req.file) {
                imageUrl = await CloudinaryService.uploadServiceImage(
                    req.file.buffer,
                    req.body.name || 'service'
                );
            }

            const categoryId = req.body.categoryId || req.body.category_id;
            const rawDisplayOrder = req.body.displayOrder !== undefined ? req.body.displayOrder : req.body.display_order;
            const parsedDisplayOrder = rawDisplayOrder !== undefined ? parseInt(rawDisplayOrder, 10) : 1;
            const displayOrder = isNaN(parsedDisplayOrder) ? 1 : Math.max(1, parsedDisplayOrder);

            const rawNote = req.body.note !== undefined ? req.body.note : undefined;
            const note = rawNote !== undefined ? sanitizeServiceNote(rawNote) : null;

            const serviceData = {
                ...req.body,
                ...(categoryId && { categoryId }),
                ...(imageUrl && { imageUrl }),
                displayOrder,
                display_order: displayOrder,
                note,
                // Ensure numeric fields are converted (FormData sends everything as strings)
                ...(req.body.basePrice !== undefined && { basePrice: parseFloat(req.body.basePrice) }),
                ...(req.body.base_price !== undefined && { basePrice: parseFloat(req.body.base_price) }),
                ...(req.body.duration !== undefined && { duration: parseInt(req.body.duration) }),
                ...(req.body.isActive !== undefined && {
                    isActive: req.body.isActive === 'true' || req.body.isActive === true
                }),
                ...(req.body.is_active !== undefined && {
                    isActive: req.body.is_active === 'true' || req.body.is_active === true
                }),
            };

            const service = await this.serviceService.createService(serviceData);
            res.status(201).json(successResponse(service, 'Service created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateService = async (req: Request, res: Response, next: NextFunction) => {
        try {
            let imageUrl = req.body.imageUrl || req.body.image_url;

            // If file uploaded, upload to Cloudinary
            if (req.file) {
                imageUrl = await CloudinaryService.uploadServiceImage(
                    req.file.buffer,
                    req.body.name || 'service_update'
                );
            }

            const categoryId = req.body.categoryId || req.body.category_id;
            const rawDisplayOrder = req.body.displayOrder !== undefined ? req.body.displayOrder : req.body.display_order;
            const parsedDisplayOrder = rawDisplayOrder !== undefined ? parseInt(rawDisplayOrder, 10) : undefined;
            const displayOrder = parsedDisplayOrder !== undefined && !isNaN(parsedDisplayOrder) ? Math.max(1, parsedDisplayOrder) : undefined;

            const rawNote = req.body.note !== undefined ? req.body.note : undefined;
            const note = rawNote !== undefined ? sanitizeServiceNote(rawNote) : undefined;

            const updateData: any = {
                ...req.body,
                ...(categoryId && { categoryId }),
                ...(imageUrl && { imageUrl }),
                ...(displayOrder !== undefined && { displayOrder, display_order: displayOrder }),
                ...(note !== undefined && { note }),
                // Ensure numeric fields are converted (FormData sends everything as strings)
                ...(req.body.basePrice !== undefined && { basePrice: parseFloat(req.body.basePrice) }),
                ...(req.body.base_price !== undefined && { basePrice: parseFloat(req.body.base_price) }),
                ...(req.body.duration !== undefined && { duration: parseInt(req.body.duration) }),
                ...(req.body.isActive !== undefined && {
                    isActive: req.body.isActive === 'true' || req.body.isActive === true
                }),
                ...(req.body.is_active !== undefined && {
                    isActive: req.body.is_active === 'true' || req.body.is_active === true
                }),
            };

            const service = await this.serviceService.updateService(
                req.params.id,
                updateData
            );
            res.json(successResponse(service, 'Service updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteService = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.serviceService.deleteService(req.params.id);
            res.json(successResponse(result, (result as any).message || 'Operation successful'));
        } catch (error) {
            next(error);
        }
    };

    // Categories
    getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const includeInactive = req.query.includeInactive === 'true' || req.query.all === 'true';
            const categories = await this.serviceService.getAllCategories(includeInactive);
            res.json(successResponse(categories, 'Categories retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createCategory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            let iconUrl = req.body.iconUrl || req.body.icon_url;

            // If file uploaded, upload to Cloudinary
            if (req.file) {
                iconUrl = await CloudinaryService.uploadCategoryIcon(
                    req.file.buffer,
                    req.body.name || 'category'
                );
            }

            const displayOrder = req.body.displayOrder !== undefined
                ? parseInt(req.body.displayOrder)
                : (req.body.display_order !== undefined ? parseInt(req.body.display_order) : 0);

            const isActive = req.body.isActive !== undefined
                ? (req.body.isActive === 'true' || req.body.isActive === true)
                : (req.body.is_active !== undefined ? (req.body.is_active === 'true' || req.body.is_active === true) : true);

            const categoryData = {
                ...req.body,
                iconUrl,
                displayOrder,
                isActive,
            };

            const category = await this.serviceService.createCategory(categoryData);
            res.status(201).json(successResponse(category, 'Category created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateCategory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            let iconUrl = req.body.iconUrl || req.body.icon_url;

            // If file uploaded, upload to Cloudinary
            if (req.file) {
                iconUrl = await CloudinaryService.uploadCategoryIcon(
                    req.file.buffer,
                    req.body.name || 'category_update'
                );
            }

            const updateData: any = {
                ...req.body,
                ...(iconUrl && { iconUrl }),
                ...(req.body.displayOrder !== undefined && { displayOrder: parseInt(req.body.displayOrder) }),
                ...(req.body.display_order !== undefined && { displayOrder: parseInt(req.body.display_order) }),
                ...(req.body.isActive !== undefined && {
                    isActive: req.body.isActive === 'true' || req.body.isActive === true
                }),
                ...(req.body.is_active !== undefined && {
                    isActive: req.body.is_active === 'true' || req.body.is_active === true
                }),
            };

            const category = await this.serviceService.updateCategory(
                req.params.id,
                updateData
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
            const pricingData = {
                ...req.body,
                ...(req.body.price !== undefined && { price: parseFloat(req.body.price) }),
            };

            const pricing = await this.serviceService.setLocationPricing(
                req.params.id,
                pricingData
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
            res.json(successResponse(result, (result as any).message || 'Operation successful'));
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

    getFeaturedServices = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const services = await this.serviceService.getFeaturedServices();
            res.json(successResponse(services, 'Featured services retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getPopularServices = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const services = await this.serviceService.getPopularServices();
            res.json(successResponse(services, 'Popular services retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };
}

