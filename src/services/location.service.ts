import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

interface CreateStateData {
    name: string;
    code: string;
}

interface CreateDistrictData {
    stateId: string;
    name: string;
}

interface CreateAreaData {
    districtId: string;
    name: string;
    pincode?: string;
}

class LocationService {
    // ==================
    // STATE MANAGEMENT
    // ==================

    async getAllStates(includeInactive = false) {
        const where = includeInactive ? {} : { is_active: true };

        const states = await prisma.state.findMany({
            where,
            include: {
                _count: {
                    select: { districts: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        return states;
    }

    async getStateById(stateId: string) {
        const state = await prisma.state.findUnique({
            where: { id: stateId },
            include: {
                districts: {
                    where: { is_active: true },
                    orderBy: { name: 'asc' },
                },
            },
        });

        if (!state) {
            throw new NotFoundError('State not found');
        }

        return state;
    }

    async createState(data: CreateStateData) {
        // Check if state already exists
        const existing = await prisma.state.findFirst({
            where: {
                OR: [{ name: data.name }, { code: data.code }],
            },
        });

        if (existing) {
            throw new BadRequestError('State with this name or code already exists');
        }

        const state = await prisma.state.create({
            data: {
                name: data.name,
                code: data.code.toUpperCase(),
                is_active: true,
            },
        });

        return state;
    }

    async updateState(stateId: string, data: Partial<CreateStateData> & { isActive?: boolean }) {
        const state = await prisma.state.findUnique({
            where: { id: stateId },
        });

        if (!state) {
            throw new NotFoundError('State not found');
        }

        const updated = await prisma.state.update({
            where: { id: stateId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.code && { code: data.code.toUpperCase() }),
                ...(data.isActive !== undefined && { is_active: data.isActive }),
            },
        });

        return updated;
    }

    // ==================
    // DISTRICT MANAGEMENT
    // ==================

    async getAllDistricts(stateId?: string, includeInactive = false, hasServicesOnly = false) {
        const where: any = {};

        if (stateId) {
            where.state_id = stateId;
        }

        if (!includeInactive) {
            where.is_active = true;
        }

        if (hasServicesOnly) {
            where.service_pricing = {
                some: {
                    is_active: true
                }
            };
        }

        const districts = await prisma.district.findMany({
            where,
            include: {
                state: true,
                _count: {
                    select: { areas: true },
                },
            },
            orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
        });

        return districts;
    }

    async getDistrictById(districtId: string) {
        const district = await prisma.district.findUnique({
            where: { id: districtId },
            include: {
                state: true,
                areas: {
                    where: { is_active: true },
                    orderBy: { name: 'asc' },
                },
            },
        });

        if (!district) {
            throw new NotFoundError('District not found');
        }

        return district;
    }

    async createDistrict(data: CreateDistrictData) {
        // Verify state exists
        const state = await prisma.state.findUnique({
            where: { id: data.stateId },
        });

        if (!state) {
            throw new NotFoundError('State not found');
        }

        // Check if district already exists in this state
        const existing = await prisma.district.findFirst({
            where: {
                state_id: data.stateId,
                name: data.name,
            },
        });

        if (existing) {
            throw new BadRequestError('District with this name already exists in the state');
        }

        const district = await prisma.district.create({
            data: {
                state_id: data.stateId,
                name: data.name,
                is_active: true,
            },
            include: {
                state: true,
            },
        });

        return district;
    }

    async updateDistrict(districtId: string, data: Partial<CreateDistrictData> & { isActive?: boolean }) {
        const district = await prisma.district.findUnique({
            where: { id: districtId },
        });

        if (!district) {
            throw new NotFoundError('District not found');
        }

        const updated = await prisma.district.update({
            where: { id: districtId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.isActive !== undefined && { is_active: data.isActive }),
            },
            include: {
                state: true,
            },
        });

        return updated;
    }

    // ==================
    // AREA MANAGEMENT
    // ==================

    async getAllAreas(districtId?: string, includeInactive = false) {
        const where: any = {};

        if (districtId) {
            where.district_id = districtId;
        }

        if (!includeInactive) {
            where.is_active = true;
        }

        const areas = await prisma.area.findMany({
            where,
            include: {
                district: {
                    include: {
                        state: true,
                    },
                },
            },
            orderBy: [{ district: { name: 'asc' } }, { name: 'asc' }],
        });

        return areas;
    }

    async getAreaById(areaId: string) {
        const area = await prisma.area.findUnique({
            where: { id: areaId },
            include: {
                district: {
                    include: {
                        state: true,
                    },
                },
            },
        });

        if (!area) {
            throw new NotFoundError('Area not found');
        }

        return area;
    }

    async createArea(data: CreateAreaData) {
        // Verify district exists
        const district = await prisma.district.findUnique({
            where: { id: data.districtId },
        });

        if (!district) {
            throw new NotFoundError('District not found');
        }

        // Check if area already exists in this district
        const existing = await prisma.area.findFirst({
            where: {
                district_id: data.districtId,
                name: data.name,
            },
        });

        if (existing) {
            throw new BadRequestError('Area with this name already exists in the district');
        }

        const area = await prisma.area.create({
            data: {
                district_id: data.districtId,
                name: data.name,
                pincode: data.pincode,
                is_active: true,
            },
            include: {
                district: {
                    include: {
                        state: true,
                    },
                },
            },
        });

        return area;
    }

    async updateArea(areaId: string, data: Partial<CreateAreaData> & { isActive?: boolean }) {
        const area = await prisma.area.findUnique({
            where: { id: areaId },
        });

        if (!area) {
            throw new NotFoundError('Area not found');
        }

        const updated = await prisma.area.update({
            where: { id: areaId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.pincode !== undefined && { pincode: data.pincode }),
                ...(data.isActive !== undefined && { is_active: data.isActive }),
            },
            include: {
                district: {
                    include: {
                        state: true,
                    },
                },
            },
        });

        return updated;
    }

    // ==================
    // LOCATION HIERARCHY
    // ==================

    async getLocationHierarchy() {
        const states = await prisma.state.findMany({
            where: { is_active: true },
            include: {
                districts: {
                    where: { is_active: true },
                    include: {
                        areas: {
                            where: { is_active: true },
                            orderBy: { name: 'asc' },
                        },
                    },
                    orderBy: { name: 'asc' },
                },
            },
            orderBy: { name: 'asc' },
        });

        return states;
    }
}

export default new LocationService();
