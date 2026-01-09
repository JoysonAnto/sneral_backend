import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

interface CreateServiceData {
    name: string;
    description: string;
    categoryId: string;
    basePrice: number;
    duration: number;
    imageUrl?: string;
}

interface CreateCategoryData {
    name: string;
    description?: string;
    iconUrl?: string;
    displayOrder?: number;
}

export class ServiceService {
    async getAllServices(filters: any) {
        const { category, search, active = 'true', page = 1, limit = 20 } = filters;

        const skip = (page - 1) * limit;

        let where: any = {};

        // Filter by category
        if (category) {
            where.category_id = category;
        }

        // Filter by active status
        if (active !== 'all') {
            where.is_active = active === 'true';
        }

        // Search by name or description
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [services, total] = await Promise.all([
            prisma.service.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            icon_url: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            prisma.service.count({ where }),
        ]);

        // Calculate average ratings (simplified - in production, you'd aggregate from ratings table)
        const servicesWithRatings = services.map(service => ({
            id: service.id,
            name: service.name,
            description: service.description,
            category: {
                id: service.category.id,
                name: service.category.name,
                iconUrl: service.category.icon_url,
            },
            basePrice: service.base_price,
            currency: 'INR',
            unit: 'per service',
            estimatedTime: service.duration,
            imageUrl: service.image_url,
            isActive: service.is_active,
            avgRating: 4.5, // TODO: Calculate from actual ratings
            totalRatings: 0, // TODO: Count from actual ratings
            createdAt: service.created_at,
        }));

        return {
            services: servicesWithRatings,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
            },
        };
    }

    async getServiceById(serviceId: string) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        icon_url: true,
                    },
                },
            },
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        return {
            id: service.id,
            name: service.name,
            description: service.description,
            category: {
                id: service.category.id,
                name: service.category.name,
                description: service.category.description,
                iconUrl: service.category.icon_url,
            },
            basePrice: service.base_price,
            currency: 'INR',
            unit: 'per service',
            estimatedTime: service.duration,
            imageUrl: service.image_url,
            isActive: service.is_active,
            avgRating: 4.5, // TODO: Calculate from actual ratings
            totalRatings: 0, // TODO: Count from actual ratings
            createdAt: service.created_at,
            updatedAt: service.updated_at,
        };
    }

    async createService(data: CreateServiceData) {
        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: data.categoryId },
        });

        if (!category) {
            throw new NotFoundError('Category not found');
        }

        const service = await prisma.service.create({
            data: {
                name: data.name,
                description: data.description,
                category_id: data.categoryId,
                base_price: data.basePrice,
                duration: data.duration,
                image_url: data.imageUrl,
                is_active: true,
            },
            include: {
                category: true,
            },
        });

        return {
            id: service.id,
            name: service.name,
            description: service.description,
            category: {
                id: service.category.id,
                name: service.category.name,
            },
            basePrice: service.base_price,
            duration: service.duration,
            imageUrl: service.image_url,
            isActive: service.is_active,
            createdAt: service.created_at,
        };
    }

    async updateService(serviceId: string, data: Partial<CreateServiceData> & { isActive?: boolean }) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        // If updating category, verify it exists
        if (data.categoryId) {
            const category = await prisma.category.findUnique({
                where: { id: data.categoryId },
            });
            if (!category) {
                throw new NotFoundError('Category not found');
            }
        }

        const updatedService = await prisma.service.update({
            where: { id: serviceId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description && { description: data.description }),
                ...(data.categoryId && { category_id: data.categoryId }),
                ...(data.basePrice !== undefined && { base_price: data.basePrice }),
                ...(data.duration && { duration: data.duration }),
                ...(data.imageUrl && { image_url: data.imageUrl }),
                ...(data.isActive !== undefined && { is_active: data.isActive }),
            },
            include: {
                category: true,
            },
        });

        return {
            id: updatedService.id,
            name: updatedService.name,
            description: updatedService.description,
            category: {
                id: updatedService.category.id,
                name: updatedService.category.name,
            },
            basePrice: updatedService.base_price,
            duration: updatedService.duration,
            imageUrl: updatedService.image_url,
            isActive: updatedService.is_active,
            updatedAt: updatedService.updated_at,
        };
    }

    async deleteService(serviceId: string) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        // Check if service has any bookings
        const bookingsCount = await prisma.bookingItem.count({
            where: { service_id: serviceId },
        });

        if (bookingsCount > 0) {
            // Soft delete by deactivating instead
            await prisma.service.update({
                where: { id: serviceId },
                data: { is_active: false },
            });
            return { message: 'Service deactivated (has existing bookings)' };
        }

        await prisma.service.delete({
            where: { id: serviceId },
        });

        return { message: 'Service deleted successfully' };
    }

    // Category Management
    async getAllCategories() {
        const categories = await prisma.category.findMany({
            where: { is_active: true },
            orderBy: { display_order: 'asc' },
            include: {
                _count: {
                    select: { services: true },
                },
            },
        });

        return categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            iconUrl: cat.icon_url,
            isActive: cat.is_active,
            servicesCount: cat._count.services,
            displayOrder: cat.display_order,
        }));
    }

    async createCategory(data: CreateCategoryData) {
        // Check if category name already exists
        const existing = await prisma.category.findUnique({
            where: { name: data.name },
        });

        if (existing) {
            throw new BadRequestError('Category with this name already exists');
        }

        const category = await prisma.category.create({
            data: {
                name: data.name,
                description: data.description,
                icon_url: data.iconUrl,
                display_order: data.displayOrder || 0,
                is_active: true,
            },
        });

        return {
            id: category.id,
            name: category.name,
            description: category.description,
            iconUrl: category.icon_url,
            displayOrder: category.display_order,
            createdAt: category.created_at,
        };
    }

    async updateCategory(categoryId: string, data: Partial<CreateCategoryData> & { isActive?: boolean }) {
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError('Category not found');
        }

        const updated = await prisma.category.update({
            where: { id: categoryId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.iconUrl && { icon_url: data.iconUrl }),
                ...(data.displayOrder !== undefined && { display_order: data.displayOrder }),
                ...(data.isActive !== undefined && { is_active: data.isActive }),
            },
        });

        return updated;
    }

    // ====================
    // LOCATION-BASED PRICING
    // ====================

    async getServiceWithLocationPricing(serviceId: string) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: {
                category: true,
                location_pricing: {
                    where: { is_active: true },
                    include: {
                        state: true,
                        district: true,
                        area: true,
                    },
                    orderBy: [
                        { state: { name: 'asc' } },
                        { district: { name: 'asc' } },
                        { area: { name: 'asc' } },
                    ],
                },
            },
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        return {
            id: service.id,
            name: service.name,
            description: service.description,
            category: service.category,
            basePrice: service.base_price,
            duration: service.duration,
            imageUrl: service.image_url,
            isActive: service.is_active,
            locationPricing: service.location_pricing.map(lp => ({
                id: lp.id,
                price: lp.price,
                state: lp.state ? { id: lp.state.id, name: lp.state.name, code: lp.state.code } : null,
                district: lp.district ? { id: lp.district.id, name: lp.district.name } : null,
                area: lp.area ? { id: lp.area.id, name: lp.area.name, pincode: lp.area.pincode } : null,
                isActive: lp.is_active,
            })),
        };
    }

    async setLocationPricing(serviceId: string, pricingData: {
        stateId?: string;
        districtId?: string;
        areaId?: string;
        price: number;
    }) {
        // Verify service exists
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        // At least one location field must be set
        if (!pricingData.stateId && !pricingData.districtId && !pricingData.areaId) {
            throw new BadRequestError('At least one location (state, district, or area) must be specified');
        }

        // Verify location hierarchy consistency
        if (pricingData.areaId) {
            const area = await prisma.area.findUnique({
                where: { id: pricingData.areaId },
                include: { district: { include: { state: true } } },
            });

            if (!area) {
                throw new NotFoundError('Area not found');
            }

            // If district or state is also specified, verify they match
            if (pricingData.districtId && pricingData.districtId !== area.district_id) {
                throw new BadRequestError('Area does not belong to the specified district');
            }
            if (pricingData.stateId && pricingData.stateId !== area.district.state_id) {
                throw new BadRequestError('Area does not belong to the specified state');
            }

            // Auto-fill district and state if not provided
            pricingData.districtId = area.district_id;
            pricingData.stateId = area.district.state_id;
        } else if (pricingData.districtId) {
            const district = await prisma.district.findUnique({
                where: { id: pricingData.districtId },
            });

            if (!district) {
                throw new NotFoundError('District not found');
            }

            // If state is also specified, verify it matches
            if (pricingData.stateId && pricingData.stateId !== district.state_id) {
                throw new BadRequestError('District does not belong to the specified state');
            }

            // Auto-fill state if not provided
            pricingData.stateId = district.state_id;
        } else if (pricingData.stateId) {
            const state = await prisma.state.findUnique({
                where: { id: pricingData.stateId },
            });

            if (!state) {
                throw new NotFoundError('State not found');
            }
        }

        // Check if pricing already exists for this exact location
        const existing = await prisma.serviceLocationPricing.findFirst({
            where: {
                service_id: serviceId,
                state_id: pricingData.stateId || null,
                district_id: pricingData.districtId || null,
                area_id: pricingData.areaId || null,
            },
        });

        let locationPricing;
        if (existing) {
            // Update existing pricing
            locationPricing = await prisma.serviceLocationPricing.update({
                where: { id: existing.id },
                data: { price: pricingData.price },
                include: {
                    state: true,
                    district: true,
                    area: true,
                },
            });
        } else {
            // Create new pricing
            locationPricing = await prisma.serviceLocationPricing.create({
                data: {
                    service_id: serviceId,
                    state_id: pricingData.stateId || null,
                    district_id: pricingData.districtId || null,
                    area_id: pricingData.areaId || null,
                    price: pricingData.price,
                    is_active: true,
                },
                include: {
                    state: true,
                    district: true,
                    area: true,
                },
            });
        }

        return {
            id: locationPricing.id,
            serviceId: locationPricing.service_id,
            price: locationPricing.price,
            state: locationPricing.state,
            district: locationPricing.district,
            area: locationPricing.area,
            isActive: locationPricing.is_active,
        };
    }

    async deleteLocationPricing(serviceId: string, pricingId: string) {
        const pricing = await prisma.serviceLocationPricing.findFirst({
            where: {
                id: pricingId,
                service_id: serviceId,
            },
        });

        if (!pricing) {
            throw new NotFoundError('Location pricing not found');
        }

        await prisma.serviceLocationPricing.delete({
            where: { id: pricingId },
        });

        return { message: 'Location pricing deleted successfully' };
    }

    async getServicePrice(serviceId: string, location: {
        stateId?: string;
        districtId?: string;
        areaId?: string;
    }) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            throw new NotFoundError('Service not found');
        }

        // Try to find most specific pricing (area > district > state > base price)
        let pricing;

        if (location.areaId) {
            pricing = await prisma.serviceLocationPricing.findFirst({
                where: {
                    service_id: serviceId,
                    area_id: location.areaId,
                    is_active: true,
                },
            });
            if (pricing) {
                return { price: pricing.price, source: 'area' };
            }
        }

        if (location.districtId) {
            pricing = await prisma.serviceLocationPricing.findFirst({
                where: {
                    service_id: serviceId,
                    district_id: location.districtId,
                    area_id: null,
                    is_active: true,
                },
            });
            if (pricing) {
                return { price: pricing.price, source: 'district' };
            }
        }

        if (location.stateId) {
            pricing = await prisma.serviceLocationPricing.findFirst({
                where: {
                    service_id: serviceId,
                    state_id: location.stateId,
                    district_id: null,
                    area_id: null,
                    is_active: true,
                },
            });
            if (pricing) {
                return { price: pricing.price, source: 'state' };
            }
        }

        // Fallback to base price
        return { price: service.base_price, source: 'base' };
    }
}

