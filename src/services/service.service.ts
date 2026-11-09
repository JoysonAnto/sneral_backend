import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

interface CreateServiceData {
    name: string;
    description: string;
    categoryId: string;
    basePrice: number;
    base_price?: number;
    duration: number;
    imageUrl?: string;
    isActive?: boolean | string;
    displayOrder?: number;
    display_order?: number;
    note?: string | null;
}

interface CreateCategoryData {
    name: string;
    description?: string;
    iconUrl?: string;
    displayOrder?: number;
    isActive?: boolean | string;
}

export interface FormattedPackage {
    id: string;
    serviceId: string;
    service_id: string;
    hours: number;
    title: string;
    durationMinutes: number;
    duration_minutes: number;
    pricingType: string;
    pricing_type: string;
    price: number;
    originalPrice: number;
    original_price: number;
    savings: number;
    discountPercentage: number;
    discount_percentage: number;
    isPopular: boolean;
    is_popular: boolean;
    isActive: boolean;
    is_active: boolean;
    displayOrder: number;
    display_order: number;
}

export function formatServicePackages(packages: any[] = [], serviceBasePrice: number = 0): FormattedPackage[] {
    if (!packages || packages.length === 0) return [];

    // Find 1-hour package or calculate base hourly rate
    const oneHourPkg = packages.find(p => Number(p.hours) === 1);
    const baseHourlyRate = oneHourPkg
        ? Number(oneHourPkg.price)
        : (serviceBasePrice > 0 ? serviceBasePrice : (Number(packages[0]?.price) / (Number(packages[0]?.hours) || 1)));

    return packages.map(pkg => {
        const calculatedOriginalPrice = pkg.original_price != null
            ? Number(pkg.original_price)
            : Math.round(Number(pkg.hours) * baseHourlyRate);

        const price = Number(pkg.price);
        const savings = Math.max(0, calculatedOriginalPrice - price);
        const autoDiscount = calculatedOriginalPrice > 0 && savings > 0
            ? Math.round((savings / calculatedOriginalPrice) * 100)
            : 0;
        const discountPercentage = pkg.discount_percentage != null
            ? Number(pkg.discount_percentage)
            : autoDiscount;
        const pricingType = pkg.pricing_type || (pkg.pricingType || 'FLAT');

        return {
            id: pkg.id,
            serviceId: pkg.service_id,
            service_id: pkg.service_id,
            hours: Number(pkg.hours),
            title: pkg.title || `${pkg.hours} ${Number(pkg.hours) === 1 ? 'Hour' : 'Hours'}`,
            durationMinutes: Math.round(Number(pkg.hours) * 60),
            duration_minutes: Math.round(Number(pkg.hours) * 60),
            pricingType,
            pricing_type: pricingType,
            price,
            originalPrice: calculatedOriginalPrice,
            original_price: calculatedOriginalPrice,
            savings,
            discountPercentage,
            discount_percentage: discountPercentage,
            isPopular: !!pkg.is_popular,
            is_popular: !!pkg.is_popular,
            isActive: pkg.is_active !== false,
            is_active: pkg.is_active !== false,
            displayOrder: pkg.display_order || 1,
            display_order: pkg.display_order || 1,
        };
    });
}

export class ServiceService {
    async getAllServices(filters: any = {}) {
        const category = filters.category || filters.categoryId;
        const search = filters.search ? String(filters.search).trim() : '';
        const includeInactive = filters.includeInactive === true || filters.includeInactive === 'true' || filters.all === 'true';
        const active = filters.active;
        const isAll = filters.all === 'true' && filters.page === undefined && filters.current_page === undefined && filters.limit === undefined && filters.per_page === undefined;
        const page = parseInt((filters.page || filters.current_page) as string) || 1;
        const limit = isAll ? 1000 : (parseInt((filters.per_page || filters.limit) as string) || 10);

        const skip = (page - 1) * limit;

        let where: any = {};

        // Filter by category
        if (category && category !== 'all' && category !== '') {
            where.category_id = category;
        }

        // Filter by active status
        if (active === 'true' || active === 'false') {
            where.is_active = active === 'true';
        } else if (!includeInactive && active !== 'all') {
            // Default to active only for consumers not requesting inactive
            where.is_active = true;
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
                take: limit,
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            icon_url: true,
                        },
                    },
                    packages: {
                        where: { is_active: true },
                        orderBy: { hours: 'asc' },
                    },
                },
                orderBy: [
                    { display_order: 'asc' },
                    { id: 'asc' },
                ],
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
                icon_url: service.category.icon_url,
                imageUrl: service.category.icon_url,
                image_url: service.category.icon_url,
            },
            basePrice: service.base_price,
            base_price: service.base_price,
            currency: 'INR',
            unit: 'per service',
            duration: service.duration,
            imageUrl: service.image_url,
            image_url: service.image_url,
            image: service.image_url,
            displayOrder: service.display_order,
            display_order: service.display_order,
            note: service.note,
            isActive: service.is_active,
            is_active: service.is_active,
            avgRating: 4.5, // TODO: Calculate from actual ratings
            totalRatings: 0, // TODO: Count from actual ratings
            packages: formatServicePackages(service.packages || [], service.base_price),
            createdAt: service.created_at,
            created_at: service.created_at,
        }));

        const totalPages = Math.max(1, Math.ceil(total / limit));
        return {
            services: servicesWithRatings,
            pagination: {
                page: page,
                limit: limit,
                total,
                totalPages,
                current_page: page,
                per_page: limit,
                last_page: totalPages,
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
                packages: {
                    where: { is_active: true },
                    orderBy: { hours: 'asc' },
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
                icon_url: service.category.icon_url,
                imageUrl: service.category.icon_url,
                image_url: service.category.icon_url,
            },
            basePrice: service.base_price,
            base_price: service.base_price,
            currency: 'INR',
            unit: 'per service',
            duration: service.duration,
            imageUrl: service.image_url,
            image_url: service.image_url,
            image: service.image_url,
            displayOrder: service.display_order,
            display_order: service.display_order,
            note: service.note,
            isActive: service.is_active,
            is_active: service.is_active,
            avgRating: 4.5, // TODO: Calculate from actual ratings
            totalRatings: 0, // TODO: Count from actual ratings
            packages: formatServicePackages(service.packages || [], service.base_price),
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

        const displayOrder = data.displayOrder !== undefined
            ? parseInt(data.displayOrder as any, 10)
            : (data.display_order !== undefined ? parseInt(data.display_order as any, 10) : 1);

        const service = await prisma.service.create({
            data: {
                name: data.name,
                description: data.description,
                category_id: data.categoryId,
                base_price: data.basePrice !== undefined ? parseFloat(data.basePrice as any) : 0,
                duration: data.duration !== undefined ? parseInt(data.duration as any, 10) : 0,
                image_url: data.imageUrl,
                display_order: isNaN(displayOrder) ? 1 : Math.max(1, displayOrder),
                note: data.note !== undefined ? data.note : null,
                is_active: data.isActive !== undefined ? (data.isActive === 'true' || data.isActive === true) : true,
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
                iconUrl: service.category.icon_url,
                icon_url: service.category.icon_url,
                imageUrl: service.category.icon_url,
                image_url: service.category.icon_url,
            },
            basePrice: service.base_price,
            base_price: service.base_price,
            duration: service.duration,
            imageUrl: service.image_url,
            image_url: service.image_url,
            image: service.image_url,
            displayOrder: service.display_order,
            display_order: service.display_order,
            note: service.note,
            isActive: service.is_active,
            is_active: service.is_active,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
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

        const rawOrder = data.displayOrder !== undefined ? data.displayOrder : data.display_order;
        const parsedOrder = rawOrder !== undefined ? parseInt(rawOrder as any, 10) : undefined;
        const displayOrder = parsedOrder !== undefined && !isNaN(parsedOrder) ? Math.max(1, parsedOrder) : undefined;

        const updatedService = await prisma.service.update({
            where: { id: serviceId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description && { description: data.description }),
                ...(data.categoryId && { category_id: data.categoryId }),
                ...(data.basePrice !== undefined && { base_price: parseFloat(data.basePrice as any) }),
                ...(data.duration !== undefined && { duration: parseInt(data.duration as any, 10) }),
                ...(data.imageUrl && { image_url: data.imageUrl }),
                ...(displayOrder !== undefined && { display_order: displayOrder }),
                ...(data.note !== undefined && { note: data.note }),
                ...(data.isActive !== undefined && { is_active: (String(data.isActive) === 'true') }),
            },
            include: {
                category: true,
            },
        });

        // If base price changed, recalculate prices for all hourly packages
        const newBasePrice = data.basePrice !== undefined
            ? parseFloat(data.basePrice as any)
            : (data.base_price !== undefined ? parseFloat(data.base_price as any) : undefined);

        if (newBasePrice !== undefined && newBasePrice > 0 && Math.round(newBasePrice) !== Math.round(service.base_price)) {
            const existingPackages = await prisma.servicePackage.findMany({
                where: { service_id: serviceId }
            });
            for (const pkg of existingPackages) {
                const originalPrice = Math.round(pkg.hours * newBasePrice);
                if (pkg.hours === 1) {
                    await prisma.servicePackage.update({
                        where: { id: pkg.id },
                        data: {
                            original_price: newBasePrice,
                            price: newBasePrice,
                            discount_percentage: 0,
                        }
                    });
                } else if (pkg.pricing_type === 'PERCENTAGE' && pkg.discount_percentage != null) {
                    const discount = pkg.discount_percentage;
                    const newPrice = Math.round(originalPrice * (1 - discount / 100));
                    await prisma.servicePackage.update({
                        where: { id: pkg.id },
                        data: {
                            original_price: originalPrice,
                            price: newPrice,
                        }
                    });
                } else {
                    // For FLAT packages, update original_price so strikethrough stays accurate
                    const autoDiscount = originalPrice > pkg.price
                        ? Math.round(((originalPrice - pkg.price) / originalPrice) * 100)
                        : 0;
                    await prisma.servicePackage.update({
                        where: { id: pkg.id },
                        data: {
                            original_price: originalPrice,
                            discount_percentage: autoDiscount,
                        }
                    });
                }
            }
        }

        return {
            id: updatedService.id,
            name: updatedService.name,
            description: updatedService.description,
            category: {
                id: updatedService.category.id,
                name: updatedService.category.name,
                iconUrl: updatedService.category.icon_url,
                icon_url: updatedService.category.icon_url,
                imageUrl: updatedService.category.icon_url,
                image_url: updatedService.category.icon_url,
            },
            basePrice: updatedService.base_price,
            base_price: updatedService.base_price,
            duration: updatedService.duration,
            imageUrl: updatedService.image_url,
            image_url: updatedService.image_url,
            image: updatedService.image_url,
            displayOrder: updatedService.display_order,
            display_order: updatedService.display_order,
            note: updatedService.note,
            isActive: updatedService.is_active,
            is_active: updatedService.is_active,
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
    async getAllCategories(filters: any = {}) {
        let includeInactive = false;
        let search = '';
        let active: string | undefined = undefined;
        let page = 1;
        let limit = 10;
        let isPaginated = false;

        if (typeof filters === 'boolean') {
            includeInactive = filters;
        } else if (filters && typeof filters === 'object') {
            includeInactive = filters.includeInactive === true || filters.includeInactive === 'true' || filters.all === 'true';
            search = filters.search ? String(filters.search).trim() : '';
            active = filters.active;

            if (filters.page !== undefined || filters.current_page !== undefined || filters.per_page !== undefined || filters.limit !== undefined || filters.paginate === 'true') {
                isPaginated = true;
                page = parseInt((filters.page || filters.current_page) as string) || 1;
                limit = parseInt((filters.per_page || filters.limit) as string) || 10;
            }
        }

        const whereClause: any = {};

        // Active status filtering
        if (active === 'true' || active === 'false') {
            whereClause.is_active = active === 'true';
        } else if (!includeInactive && active !== 'all') {
            whereClause.is_active = true;
        }

        // Search by name or description
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [categories, total] = await Promise.all([
            prisma.category.findMany({
                where: whereClause,
                skip: isPaginated ? skip : undefined,
                take: isPaginated ? limit : undefined,
                orderBy: [
                    { display_order: 'asc' },
                    { id: 'asc' },
                ],
                include: {
                    _count: {
                        select: { services: true },
                    },
                },
            }),
            prisma.category.count({ where: whereClause }),
        ]);

        const formattedCategories = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            iconUrl: cat.icon_url,
            icon_url: cat.icon_url,
            imageUrl: cat.icon_url,
            image_url: cat.icon_url,
            isActive: cat.is_active,
            servicesCount: cat._count?.services || 0,
            displayOrder: cat.display_order,
            createdAt: cat.created_at,
            updatedAt: cat.updated_at,
        }));

        if (isPaginated) {
            const totalPages = Math.max(1, Math.ceil(total / limit));
            return {
                categories: formattedCategories,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    current_page: page,
                    per_page: limit,
                    last_page: totalPages,
                },
            };
        }

        return formattedCategories;
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
                is_active: data.isActive !== undefined ? (String(data.isActive) === 'true') : true,
            },
        });

        return {
            id: category.id,
            name: category.name,
            description: category.description,
            iconUrl: category.icon_url,
            icon_url: category.icon_url,
            imageUrl: category.icon_url,
            image_url: category.icon_url,
            isActive: category.is_active,
            displayOrder: category.display_order,
            createdAt: category.created_at,
            updatedAt: category.updated_at,
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

        return {
            id: updated.id,
            name: updated.name,
            description: updated.description,
            iconUrl: updated.icon_url,
            icon_url: updated.icon_url,
            imageUrl: updated.icon_url,
            image_url: updated.icon_url,
            isActive: updated.is_active,
            displayOrder: updated.display_order,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
        };
    }

    // ====================
    // LOCATION-BASED PRICING
    // ====================

    async getServiceWithLocationPricing(serviceId: string) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: {
                category: true,
                packages: {
                    where: { is_active: true },
                    orderBy: { hours: 'asc' },
                },
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
            packages: formatServicePackages(service.packages || [], service.base_price),
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

    async getFeaturedServices() {
        const services = await prisma.service.findMany({
            where: { is_active: true },
            take: 6,
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
        });

        return services.map(service => ({
            id: service.id,
            name: service.name,
            description: service.description,
            category: {
                id: service.category.id,
                name: service.category.name,
                iconUrl: service.category.icon_url,
                icon_url: service.category.icon_url,
                imageUrl: service.category.icon_url,
                image_url: service.category.icon_url,
            },
            basePrice: service.base_price,
            base_price: service.base_price,
            currency: 'INR',
            unit: 'per service',
            duration: service.duration,
            imageUrl: service.image_url,
            image_url: service.image_url,
            image: service.image_url,
            isActive: service.is_active,
            is_active: service.is_active,
            avgRating: 4.8, // Default high rating for featured
            totalRatings: 10,
            createdAt: service.created_at,
        }));
    }

    async getPopularServices() {
        // For now, popular = most booked or just recent ones with high default rating
        const services = await prisma.service.findMany({
            where: { is_active: true },
            take: 6,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        icon_url: true,
                    },
                },
            },
            orderBy: { created_at: 'asc' }, // Older ones or different order for variety
        });

        return services.map(service => ({
            id: service.id,
            name: service.name,
            description: service.description,
            category: {
                id: service.category.id,
                name: service.category.name,
                iconUrl: service.category.icon_url,
                icon_url: service.category.icon_url,
                imageUrl: service.category.icon_url,
                image_url: service.category.icon_url,
            },
            basePrice: service.base_price,
            base_price: service.base_price,
            currency: 'INR',
            unit: 'per service',
            duration: service.duration,
            imageUrl: service.image_url,
            image_url: service.image_url,
            image: service.image_url,
            isActive: service.is_active,
            is_active: service.is_active,
            avgRating: 4.9,
            totalRatings: 25,
            createdAt: service.created_at,
        }));
    }

    async getServicePackages(serviceId: string) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: {
                packages: {
                    orderBy: { hours: 'asc' },
                },
            },
        });
        if (!service) throw new NotFoundError('Service not found');
        return formatServicePackages(service.packages, service.base_price);
    }

    async createServicePackage(serviceId: string, data: any) {
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) throw new NotFoundError('Service not found');

        const hours = parseFloat(data.hours);
        const baseHourlyRate = service.base_price > 0 ? service.base_price : 219;
        const originalPrice = (data.original_price != null || data.originalPrice != null)
            ? parseFloat(data.original_price ?? data.originalPrice)
            : Math.round(hours * baseHourlyRate);

        const pricingType = data.pricing_type || data.pricingType || (data.discount_percentage != null || data.discountPercentage != null ? 'PERCENTAGE' : 'FLAT');
        let discountPercentage = data.discount_percentage != null
            ? parseFloat(data.discount_percentage)
            : (data.discountPercentage != null ? parseFloat(data.discountPercentage) : null);

        let price = data.price != null ? parseFloat(data.price) : 0;
        if (pricingType === 'PERCENTAGE') {
            const pct = discountPercentage != null ? discountPercentage : 0;
            price = Math.round(originalPrice * (1 - pct / 100));
        } else {
            if (discountPercentage == null && originalPrice > price) {
                discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);
            }
        }

        const pkg = await prisma.servicePackage.create({
            data: {
                service_id: serviceId,
                hours,
                title: data.title || `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`,
                pricing_type: pricingType,
                discount_percentage: discountPercentage,
                price,
                original_price: originalPrice,
                is_popular: data.is_popular === true || data.isPopular === true,
                is_active: data.is_active !== false && data.isActive !== false,
                display_order: parseInt(data.display_order || data.displayOrder || '1', 10),
            },
        });
        return pkg;
    }

    async updateServicePackage(packageId: string, data: any) {
        const existing = await prisma.servicePackage.findUnique({
            where: { id: packageId },
            include: { service: true }
        });
        if (!existing) throw new NotFoundError('Package not found');

        const baseHourlyRate = existing.service?.base_price > 0 ? existing.service.base_price : 219;
        const hours = data.hours != null ? parseFloat(data.hours) : existing.hours;
        const originalPrice = (data.original_price !== undefined || data.originalPrice !== undefined)
            ? ((data.original_price ?? data.originalPrice) != null ? parseFloat(data.original_price ?? data.originalPrice) : null)
            : Math.round(hours * baseHourlyRate);

        const pricingType = data.pricing_type || data.pricingType || existing.pricing_type || 'FLAT';
        let discountPercentage = data.discount_percentage !== undefined
            ? (data.discount_percentage != null ? parseFloat(data.discount_percentage) : null)
            : (data.discountPercentage !== undefined ? (data.discountPercentage != null ? parseFloat(data.discountPercentage) : null) : existing.discount_percentage);

        let price = data.price != null ? parseFloat(data.price) : existing.price;
        if (pricingType === 'PERCENTAGE') {
            const pct = discountPercentage != null ? discountPercentage : 0;
            if (originalPrice != null) {
                price = Math.round(originalPrice * (1 - pct / 100));
            }
        } else if (originalPrice != null && price != null && originalPrice > price) {
            discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);
        }

        const updateData: any = {
            hours,
            price,
            original_price: originalPrice,
            pricing_type: pricingType,
            discount_percentage: discountPercentage,
        };
        if (data.title != null) updateData.title = data.title;
        if (data.is_popular !== undefined || data.isPopular !== undefined) {
            updateData.is_popular = data.is_popular ?? data.isPopular;
        }
        if (data.is_active !== undefined || data.isActive !== undefined) {
            updateData.is_active = data.is_active ?? data.isActive;
        }
        if (data.display_order != null || data.displayOrder != null) {
            updateData.display_order = parseInt(data.display_order ?? data.displayOrder, 10);
        }

        const pkg = await prisma.servicePackage.update({
            where: { id: packageId },
            data: updateData,
        });
        return pkg;
    }

    async saveBulkServicePackages(serviceId: string, packagesData: any[]) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: { packages: true }
        });
        if (!service) throw new NotFoundError('Service not found');

        if (!Array.isArray(packagesData) || packagesData.length === 0) {
            throw new BadRequestError('Packages array is required');
        }

        // 1. Identify 1-hour package to sync service base price if provided
        const oneHrInput = packagesData.find(p => Number(p.hours) === 1);
        let baseHourlyRate = service.base_price > 0 ? service.base_price : 219;
        if (oneHrInput && oneHrInput.price != null && Number(oneHrInput.price) > 0) {
            baseHourlyRate = Number(oneHrInput.price);
            if (Math.round(baseHourlyRate) !== Math.round(service.base_price)) {
                await prisma.service.update({
                    where: { id: serviceId },
                    data: { base_price: baseHourlyRate }
                });
            }
        }

        // Map existing packages by id and by hours
        const existingById = new Map(service.packages.map(p => [p.id, p]));
        const existingByHours = new Map(service.packages.map(p => [Number(p.hours), p]));

        for (let i = 0; i < packagesData.length; i++) {
            const item = packagesData[i];
            const hours = Number(item.hours);
            if (isNaN(hours) || hours <= 0) continue;

            const pricingType = item.pricing_type || item.pricingType || (item.discount_percentage != null ? 'PERCENTAGE' : 'FLAT');
            const originalPrice = Math.round(hours * baseHourlyRate);

            let discountPercentage = item.discount_percentage != null
                ? parseFloat(item.discount_percentage)
                : (item.discountPercentage != null ? parseFloat(item.discountPercentage) : null);

            let price = item.price != null ? parseFloat(item.price) : 0;

            if (hours === 1) {
                price = baseHourlyRate;
                discountPercentage = 0;
            } else if (pricingType === 'PERCENTAGE') {
                const pct = discountPercentage != null ? discountPercentage : 0;
                price = Math.round(originalPrice * (1 - pct / 100));
            } else {
                // FLAT
                if (discountPercentage == null && originalPrice > price) {
                    discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);
                }
            }

            const title = item.title || (hours === 1 ? '1 Hour (60 mins)' : `${hours} Hours (${Math.round(hours * 60)} mins)`);
            const isPopular = item.is_popular === true || item.isPopular === true || (item.is_popular === undefined && hours === 3);
            const isActive = item.is_active !== false && item.isActive !== false;
            const displayOrder = item.display_order != null ? parseInt(item.display_order, 10) : (i + 1);

            // Check if existing package matches by ID or by hours
            const existing = (item.id && existingById.get(item.id)) || existingByHours.get(hours);

            if (existing) {
                await prisma.servicePackage.update({
                    where: { id: existing.id },
                    data: {
                        hours,
                        title,
                        pricing_type: pricingType,
                        discount_percentage: discountPercentage,
                        price,
                        original_price: originalPrice,
                        is_popular: isPopular,
                        is_active: isActive,
                        display_order: displayOrder,
                    }
                });
            } else {
                await prisma.servicePackage.create({
                    data: {
                        service_id: serviceId,
                        hours,
                        title,
                        pricing_type: pricingType,
                        discount_percentage: discountPercentage,
                        price,
                        original_price: originalPrice,
                        is_popular: isPopular,
                        is_active: isActive,
                        display_order: displayOrder,
                    }
                });
            }
        }

        return this.getServicePackages(serviceId);
    }

    async deleteServicePackage(packageId: string) {
        const existing = await prisma.servicePackage.findUnique({ where: { id: packageId } });
        if (!existing) throw new NotFoundError('Package not found');

        await prisma.servicePackage.delete({ where: { id: packageId } });
        return { success: true, message: 'Package deleted successfully' };
    }
}

