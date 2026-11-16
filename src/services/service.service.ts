import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

interface CreateServiceData {
    name: string;
    description: string;
    categoryId: string;
    basePrice: number;
    base_price?: number;
    duration: number;
    pricingModel?: string;
    pricing_model?: string;
    unitLabel?: string;
    unit_label?: string;
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
    orderCount?: number;
    order_count?: number;
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

export function formatServicePackages(
    packages: any[] = [], 
    serviceBasePrice: number = 0,
    pricingModel: string = 'TIME_BASED',
    unitLabel: string = 'order'
): FormattedPackage[] {
    if (!packages || packages.length === 0) return [];

    const isOrderBased = pricingModel === 'ORDER_BASED';

    // Find 1-hour or 1-order package or calculate base rate
    const basePkg = packages.find(p => (isOrderBased ? Number(p.order_count ?? p.hours) === 1 : Number(p.hours) === 1));
    const baseRate = basePkg
        ? Number(basePkg.price)
        : (serviceBasePrice > 0 ? serviceBasePrice : (Number(packages[0]?.price) / (Number(isOrderBased ? (packages[0]?.order_count ?? packages[0]?.hours) : packages[0]?.hours) || 1)));

    return packages.map(pkg => {
        const orderCount = pkg.order_count != null ? Number(pkg.order_count) : Math.round(Number(pkg.hours) || 1);
        const multiplier = isOrderBased ? orderCount : Number(pkg.hours);

        const calculatedOriginalPrice = pkg.original_price != null
            ? Number(pkg.original_price)
            : Math.round(multiplier * baseRate);

        const price = Number(pkg.price);
        const savings = Math.max(0, calculatedOriginalPrice - price);
        const autoDiscount = calculatedOriginalPrice > 0 && savings > 0
            ? Math.round((savings / calculatedOriginalPrice) * 100)
            : 0;
        const discountPercentage = pkg.discount_percentage != null
            ? Number(pkg.discount_percentage)
            : autoDiscount;
        const pricingType = pkg.pricing_type || (pkg.pricingType || 'FLAT');

        let defaultTitle: string;
        if (isOrderBased) {
            const rawUnit = unitLabel?.trim() || 'Order';
            const pluralUnit = orderCount === 1 ? rawUnit : (rawUnit.endsWith('s') ? rawUnit : `${rawUnit}s`);
            defaultTitle = `${orderCount} ${pluralUnit}`;
        } else {
            defaultTitle = pkg.title || `${pkg.hours} ${Number(pkg.hours) === 1 ? 'Hour' : 'Hours'}`;
        }

        const durationMinutes = isOrderBased ? 0 : Math.round(Number(pkg.hours) * 60);

        return {
            id: pkg.id,
            serviceId: pkg.service_id,
            service_id: pkg.service_id,
            hours: Number(pkg.hours),
            orderCount: orderCount,
            order_count: orderCount,
            title: pkg.title || defaultTitle,
            durationMinutes: durationMinutes,
            duration_minutes: durationMinutes,
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

        let where: any = {
            is_deleted: false,
        };

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
            pricingModel: service.pricing_model || 'TIME_BASED',
            pricing_model: service.pricing_model || 'TIME_BASED',
            unitLabel: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit_label: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit: service.pricing_model === 'ORDER_BASED' ? `per ${service.unit_label || 'order'}` : 'per service',
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
            packages: formatServicePackages(service.packages || [], service.base_price, service.pricing_model, service.unit_label || 'order'),
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

        if (!service || service.is_deleted) {
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
            pricingModel: service.pricing_model || 'TIME_BASED',
            pricing_model: service.pricing_model || 'TIME_BASED',
            unitLabel: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit_label: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit: service.pricing_model === 'ORDER_BASED' ? `per ${service.unit_label || 'order'}` : 'per service',
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
            packages: formatServicePackages(service.packages || [], service.base_price, service.pricing_model, service.unit_label || 'order'),
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

        const isRepeated = (data as any).isRepeated !== undefined 
            ? ((data as any).isRepeated === true || (data as any).isRepeated === 'true')
            : ((data as any).is_repeated !== undefined ? ((data as any).is_repeated === true || (data as any).is_repeated === 'true') : false);
        const repeatedOrder = (data as any).repeatedOrder !== undefined 
            ? parseInt((data as any).repeatedOrder, 10)
            : ((data as any).repeated_order !== undefined ? parseInt((data as any).repeated_order, 10) : 0);

        const rawPricingModel = (data as any).pricingModel || (data as any).pricing_model;
        const pricingModel = rawPricingModel === 'ORDER_BASED' ? 'ORDER_BASED' : 'TIME_BASED';

        const rawUnitLabel = (data as any).unitLabel || (data as any).unit_label;
        const unitLabel = rawUnitLabel ? String(rawUnitLabel).trim() : (pricingModel === 'ORDER_BASED' ? 'order' : 'hour');

        const service = await prisma.service.create({
            data: {
                name: data.name,
                description: data.description,
                category_id: data.categoryId,
                base_price: data.basePrice !== undefined ? parseFloat(data.basePrice as any) : 0,
                duration: data.duration !== undefined ? parseInt(data.duration as any, 10) : 0,
                pricing_model: pricingModel,
                unit_label: unitLabel,
                image_url: data.imageUrl,
                display_order: isNaN(displayOrder) ? 1 : Math.max(1, displayOrder),
                is_repeated: isRepeated,
                repeated_order: isNaN(repeatedOrder) ? 0 : repeatedOrder,
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
            pricingModel: service.pricing_model,
            pricing_model: service.pricing_model,
            unitLabel: service.unit_label,
            unit_label: service.unit_label,
            unit: service.pricing_model === 'ORDER_BASED' ? `per ${service.unit_label || 'order'}` : 'per service',
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

        const rawIsRepeated = (data as any).isRepeated !== undefined ? (data as any).isRepeated : (data as any).is_repeated;
        const isRepeated = rawIsRepeated !== undefined ? (rawIsRepeated === true || String(rawIsRepeated) === 'true') : undefined;

        const rawRepeatedOrder = (data as any).repeatedOrder !== undefined ? (data as any).repeatedOrder : (data as any).repeated_order;
        const repeatedOrder = rawRepeatedOrder !== undefined ? parseInt(String(rawRepeatedOrder), 10) : undefined;

        const rawPricingModel = (data as any).pricingModel !== undefined ? (data as any).pricingModel : (data as any).pricing_model;
        const pricingModel = rawPricingModel ? (String(rawPricingModel).trim() === 'ORDER_BASED' ? 'ORDER_BASED' : 'TIME_BASED') : undefined;

        const rawUnitLabel = (data as any).unitLabel !== undefined ? (data as any).unitLabel : (data as any).unit_label;
        const unitLabel = rawUnitLabel !== undefined ? String(rawUnitLabel).trim() : undefined;

        const updatedService = await prisma.service.update({
            where: { id: serviceId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description && { description: data.description }),
                ...(data.categoryId && { category_id: data.categoryId }),
                ...(data.basePrice !== undefined && { base_price: parseFloat(data.basePrice as any) }),
                ...(data.duration !== undefined && { duration: parseInt(data.duration as any, 10) }),
                ...(pricingModel && { pricing_model: pricingModel }),
                ...(unitLabel !== undefined && { unit_label: unitLabel }),
                ...(data.imageUrl && { image_url: data.imageUrl }),
                ...(displayOrder !== undefined && { display_order: displayOrder }),
                ...(isRepeated !== undefined && { is_repeated: isRepeated }),
                ...(repeatedOrder !== undefined && !isNaN(repeatedOrder) && { repeated_order: repeatedOrder }),
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
            pricingModel: updatedService.pricing_model,
            pricing_model: updatedService.pricing_model,
            unitLabel: updatedService.unit_label,
            unit_label: updatedService.unit_label,
            unit: updatedService.pricing_model === 'ORDER_BASED' ? `per ${updatedService.unit_label || 'order'}` : 'per service',
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

        // Soft delete service
        await prisma.service.update({
            where: { id: serviceId },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                is_active: false,
            },
        });

        // Deactivate associated packages
        await prisma.servicePackage.updateMany({
            where: { service_id: serviceId },
            data: { is_active: false },
        });

        return { success: true, message: 'Service soft-deleted successfully' };
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

        const whereClause: any = {
            is_deleted: false,
        };

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
                        select: {
                            services: {
                                where: { is_deleted: false },
                            },
                        },
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
            if (existing.is_deleted) {
                // Restore and update soft-deleted category
                const restored = await prisma.category.update({
                    where: { id: existing.id },
                    data: {
                        is_deleted: false,
                        deleted_at: null,
                        description: data.description,
                        icon_url: data.iconUrl,
                        display_order: data.displayOrder || 0,
                        is_active: data.isActive !== undefined ? (String(data.isActive) === 'true') : true,
                    },
                });
                return {
                    id: restored.id,
                    name: restored.name,
                    description: restored.description,
                    iconUrl: restored.icon_url,
                    icon_url: restored.icon_url,
                    imageUrl: restored.icon_url,
                    image_url: restored.icon_url,
                    isActive: restored.is_active,
                    displayOrder: restored.display_order,
                    createdAt: restored.created_at,
                    updatedAt: restored.updated_at,
                };
            }
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

    async deleteCategory(categoryId: string) {
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError('Category not found');
        }

        // Check if there are active (non-deleted) services mapped to this category
        const activeServicesCount = await prisma.service.count({
            where: {
                category_id: categoryId,
                is_deleted: false,
            },
        });

        if (activeServicesCount > 0) {
            throw new BadRequestError(
                `Cannot delete category "${category.name}": ${activeServicesCount} active service(s) are currently mapped to this category. Please delete all mapped services before deleting the category.`
            );
        }

        await prisma.category.update({
            where: { id: categoryId },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                is_active: false,
            },
        });

        return { success: true, message: 'Category soft-deleted successfully' };
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

    async getRepeatedServices() {
        let services = await prisma.service.findMany({
            where: { is_active: true, is_repeated: true, is_deleted: false },
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
                    orderBy: { hours: 'asc' }
                }
            },
            orderBy: [
                { repeated_order: 'asc' },
                { display_order: 'asc' },
                { created_at: 'desc' }
            ],
        });

        // Fallback: if no services are marked as repeated yet, provide top active services
        if (services.length === 0) {
            services = await prisma.service.findMany({
                where: { is_active: true, is_deleted: false },
                take: 8,
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
                        orderBy: { hours: 'asc' }
                    }
                },
                orderBy: { display_order: 'asc' },
            });
        }

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
            effective_price: service.base_price,
            price: service.base_price,
            currency: 'INR',
            pricingModel: service.pricing_model || 'TIME_BASED',
            pricing_model: service.pricing_model || 'TIME_BASED',
            unitLabel: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit_label: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit: service.pricing_model === 'ORDER_BASED' ? `per ${service.unit_label || 'order'}` : 'per service',
            duration: service.duration,
            imageUrl: service.image_url,
            image_url: service.image_url,
            image: service.image_url,
            isRepeated: service.is_repeated,
            is_repeated: service.is_repeated,
            repeatedOrder: service.repeated_order,
            repeated_order: service.repeated_order,
            isActive: service.is_active,
            is_active: service.is_active,
            packages: formatServicePackages((service as any).packages || [], service.base_price, service.pricing_model, service.unit_label || 'order'),
            avgRating: 4.8,
            totalRatings: 10,
            createdAt: service.created_at,
        }));
    }

    async getFeaturedServices() {
        return this.getRepeatedServices();
    }

    async updateRepeatedServicesBulk(serviceIds: string[]) {
        return await prisma.$transaction(async (tx) => {
            // First mark all services as not repeated
            await tx.service.updateMany({
                data: {
                    is_repeated: false,
                    repeated_order: 0,
                }
            });

            // Set is_repeated = true and their order for the given list
            for (let i = 0; i < serviceIds.length; i++) {
                const sId = serviceIds[i];
                await tx.service.update({
                    where: { id: sId },
                    data: {
                        is_repeated: true,
                        repeated_order: i + 1,
                    }
                });
            }

            return { message: 'Repeated services updated successfully', count: serviceIds.length };
        });
    }

    async getPopularServices() {
        // For now, popular = most booked or just recent ones with high default rating
        const services = await prisma.service.findMany({
            where: { is_active: true, is_deleted: false },
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
            pricingModel: service.pricing_model || 'TIME_BASED',
            pricing_model: service.pricing_model || 'TIME_BASED',
            unitLabel: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit_label: service.unit_label || (service.pricing_model === 'ORDER_BASED' ? 'order' : 'hour'),
            unit: service.pricing_model === 'ORDER_BASED' ? `per ${service.unit_label || 'order'}` : 'per service',
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
        return formatServicePackages(service.packages, service.base_price, service.pricing_model, service.unit_label || 'order');
    }

    async createServicePackage(serviceId: string, data: any) {
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) throw new NotFoundError('Service not found');

        const isOrderBased = service.pricing_model === 'ORDER_BASED';
        const hours = data.hours != null ? parseFloat(data.hours) : 1;
        const orderCount = data.order_count != null ? parseInt(data.order_count, 10) : (data.orderCount != null ? parseInt(data.orderCount, 10) : (isOrderBased ? Math.round(hours) : 1));
        const multiplier = isOrderBased ? orderCount : hours;

        const baseRate = service.base_price > 0 ? service.base_price : 219;
        const originalPrice = (data.original_price != null || data.originalPrice != null)
            ? parseFloat(data.original_price ?? data.originalPrice)
            : Math.round(multiplier * baseRate);

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

        const rawUnit = service.unit_label?.trim() || 'Order';
        const pluralUnit = orderCount === 1 ? rawUnit : (rawUnit.endsWith('s') ? rawUnit : `${rawUnit}s`);
        const defaultTitle = isOrderBased
            ? `${orderCount} ${pluralUnit}`
            : `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;

        const pkg = await prisma.servicePackage.create({
            data: {
                service_id: serviceId,
                hours,
                order_count: orderCount,
                title: data.title || defaultTitle,
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

        const isOrderBased = existing.service?.pricing_model === 'ORDER_BASED';
        const baseRate = existing.service?.base_price > 0 ? existing.service.base_price : 219;
        const hours = data.hours != null ? parseFloat(data.hours) : existing.hours;
        const orderCount = data.order_count != null ? parseInt(data.order_count, 10) : (data.orderCount != null ? parseInt(data.orderCount, 10) : (existing.order_count ?? (isOrderBased ? Math.round(hours) : 1)));
        const multiplier = isOrderBased ? orderCount : hours;

        const originalPrice = (data.original_price !== undefined || data.originalPrice !== undefined)
            ? ((data.original_price ?? data.originalPrice) != null ? parseFloat(data.original_price ?? data.originalPrice) : null)
            : Math.round(multiplier * baseRate);

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
            order_count: orderCount,
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

        const isOrderBased = service.pricing_model === 'ORDER_BASED';

        // 1. Identify base package (1 hour or 1 order) to sync service base price if provided
        const basePkgInput = packagesData.find(p => (isOrderBased ? Number(p.order_count ?? p.hours) === 1 : Number(p.hours) === 1));
        let baseRate = service.base_price > 0 ? service.base_price : 219;
        if (basePkgInput && basePkgInput.price != null && Number(basePkgInput.price) > 0) {
            baseRate = Number(basePkgInput.price);
            if (Math.round(baseRate) !== Math.round(service.base_price)) {
                await prisma.service.update({
                    where: { id: serviceId },
                    data: { base_price: baseRate }
                });
            }
        }

        // Map existing packages by id and by hours
        const existingById = new Map(service.packages.map(p => [p.id, p]));
        const existingByHours = new Map(service.packages.map(p => [Number(p.hours), p]));

        for (let i = 0; i < packagesData.length; i++) {
            const item = packagesData[i];
            const hours = Number(item.hours) || 1;
            const orderCount = item.order_count != null ? Number(item.order_count) : (item.orderCount != null ? Number(item.orderCount) : (isOrderBased ? Math.round(hours) : 1));
            const multiplier = isOrderBased ? orderCount : hours;
            if (isNaN(multiplier) || multiplier <= 0) continue;

            const pricingType = item.pricing_type || item.pricingType || (item.discount_percentage != null ? 'PERCENTAGE' : 'FLAT');
            const originalPrice = Math.round(multiplier * baseRate);

            let discountPercentage = item.discount_percentage != null
                ? parseFloat(item.discount_percentage)
                : (item.discountPercentage != null ? parseFloat(item.discountPercentage) : null);

            let price = item.price != null ? parseFloat(item.price) : 0;

            if (multiplier === 1) {
                price = baseRate;
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

            const rawUnit = service.unit_label?.trim() || 'Order';
            const pluralUnit = orderCount === 1 ? rawUnit : (rawUnit.endsWith('s') ? rawUnit : `${rawUnit}s`);
            const defaultTitle = isOrderBased
                ? `${orderCount} ${pluralUnit}`
                : (hours === 1 ? '1 Hour (60 mins)' : `${hours} Hours (${Math.round(hours * 60)} mins)`);

            const title = item.title || defaultTitle;
            const isPopular = item.is_popular === true || item.isPopular === true || (item.is_popular === undefined && multiplier === (isOrderBased ? 2 : 3));
            const isActive = item.is_active !== false && item.isActive !== false;
            const displayOrder = item.display_order != null ? parseInt(item.display_order, 10) : (i + 1);

            // Check if existing package matches by ID or by hours
            const existing = (item.id && existingById.get(item.id)) || existingByHours.get(hours);

            if (existing) {
                await prisma.servicePackage.update({
                    where: { id: existing.id },
                    data: {
                        hours,
                        order_count: orderCount,
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
                        order_count: orderCount,
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

