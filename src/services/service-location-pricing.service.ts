import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ServiceLocationPricingService {
    // Get pricing for a specific service in a specific location
    async getPricingByLocation(
        serviceId: string,
        stateId?: string,
        districtId?: string,
        areaId?: string
    ) {
        // Priority: Area > District > State
        const pricing = await prisma.serviceLocationPricing.findFirst({
            where: {
                service_id: serviceId,
                is_active: true,
                OR: [
                    ...(areaId ? [{ area_id: areaId }] : []),
                    ...(districtId ? [{ district_id: districtId, area_id: null }] : []),
                    ...(stateId ? [{ state_id: stateId, district_id: null, area_id: null }] : []),
                ],
            },
            include: {
                service: true,
                state: true,
                district: true,
                area: true,
            },
            orderBy: [
                { area_id: 'desc' },     // Area-specific pricing first
                { district_id: 'desc' }, // Then district
                { state_id: 'desc' },    // Then state
            ],
            take: 1,
        });

        return pricing;
    }

    // Get all services with pricing for a specific location
    async getServicesWithPricing(districtId: string, areaId?: string) {
        const services = await prisma.service.findMany({
            where: { is_active: true },
            include: {
                category: true,
                location_pricing: {
                    where: {
                        is_active: true,
                        OR: [
                            ...(areaId ? [{ area_id: areaId }] : []),
                            { district_id: districtId, area_id: null },
                        ],
                    },
                    orderBy: [
                        { area_id: 'desc' },
                        { district_id: 'desc' },
                    ],
                    take: 1,
                },
            },
        });

        // Map to include the effective price
        return services.map((service) => ({
            ...service,
            effective_price:
                service.location_pricing[0]?.price || service.base_price,
            has_location_discount:
                service.location_pricing[0]?.price &&
                service.location_pricing[0].price < service.base_price,
            savings:
                service.location_pricing[0]?.price
                    ? service.base_price - service.location_pricing[0].price
                    : 0,
        }));
    }

    // Get service detail with location-specific pricing
    async getServiceWithPricing(serviceId: string, districtId?: string, areaId?: string) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            include: {
                category: true,
                location_pricing: districtId
                    ? {
                        where: {
                            is_active: true,
                            OR: [
                                ...(areaId ? [{ area_id: areaId }] : []),
                                { district_id: districtId, area_id: null },
                            ],
                        },
                        include: {
                            state: true,
                            district: true,
                            area: true,
                        },
                        orderBy: [
                            { area_id: 'desc' },
                            { district_id: 'desc' },
                        ],
                        take: 1,
                    }
                    : true,
            },
        });

        if (!service) return null;

        const locationPricing = service.location_pricing[0];
        return {
            ...service,
            effective_price: locationPricing?.price || service.base_price,
            has_location_discount:
                locationPricing?.price && locationPricing.price < service.base_price,
            savings: locationPricing?.price
                ? service.base_price - locationPricing.price
                : 0,
            location: locationPricing
                ? {
                    state: (locationPricing as any).state?.name,
                    district: (locationPricing as any).district?.name,
                    area: (locationPricing as any).area?.name,
                }
                : null,
        };
    }

    // Get all pricing records for a service
    async getAllPricingForService(serviceId: string) {
        return prisma.serviceLocationPricing.findMany({
            where: {
                service_id: serviceId,
                is_active: true,
            },
            include: {
                state: true,
                district: true,
                area: true,
            },
            orderBy: [
                { area_id: 'asc' },
                { district_id: 'asc' },
                { state_id: 'asc' },
            ],
        });
    }

    // Get available locations with pricing for a service
    async getAvailableLocationsForService(serviceId: string) {
        const pricingRecords = await this.getAllPricingForService(serviceId);

        // Group by district
        const locationMap = new Map();

        pricingRecords.forEach((pricing) => {
            const districtId = pricing.district_id;
            if (!districtId) return;

            if (!locationMap.has(districtId)) {
                locationMap.set(districtId, {
                    district_id: districtId,
                    district_name: pricing.district?.name,
                    state_name: pricing.state?.name,
                    price: pricing.price,
                    areas: [],
                });
            }

            if (pricing.area_id) {
                locationMap.get(districtId).areas.push({
                    area_id: pricing.area_id,
                    area_name: pricing.area?.name,
                    pincode: pricing.area?.pincode,
                    price: pricing.price,
                });
            }
        });

        return Array.from(locationMap.values());
    }

    // Create or update location pricing
    async upsertLocationPricing(data: {
        service_id: string;
        state_id?: string;
        district_id?: string;
        area_id?: string;
        price: number;
        is_active?: boolean;
    }) {
        const existing = await prisma.serviceLocationPricing.findFirst({
            where: {
                service_id: data.service_id,
                state_id: data.state_id || null,
                district_id: data.district_id || null,
                area_id: data.area_id || null,
            },
        });

        if (existing) {
            return prisma.serviceLocationPricing.update({
                where: { id: existing.id },
                data: {
                    price: data.price,
                    is_active: data.is_active ?? true,
                },
            });
        }

        return prisma.serviceLocationPricing.create({
            data: {
                ...data,
                is_active: data.is_active ?? true,
            },
        });
    }

    // Compare prices across locations for a service
    async comparePricesAcrossLocations(serviceId: string) {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
            select: { name: true, base_price: true },
        });

        const pricing = await this.getAllPricingForService(serviceId);

        return {
            service_name: service?.name,
            base_price: service?.base_price,
            location_pricing: pricing.map((p) => ({
                location: {
                    state: p.state?.name,
                    district: p.district?.name,
                    area: p.area?.name,
                },
                price: p.price,
                savings: service ? service.base_price - p.price : 0,
                discount_percentage: service
                    ? ((service.base_price - p.price) / service.base_price) * 100
                    : 0,
            })),
        };
    }
}

export const serviceLocationPricingService = new ServiceLocationPricingService();
