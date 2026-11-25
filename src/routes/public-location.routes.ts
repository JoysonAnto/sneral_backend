import { Router, Request, Response } from 'express';
import { serviceLocationPricingService } from '../services/service-location-pricing.service';
import locationService from '../services/location.service';
import prisma from '../config/database';

const router = Router();

// PUBLIC ENDPOINTS - No authentication required for browsing

// GET /api/v1/public/locations/check-pincode/:pincode
router.get('/check-pincode/:pincode', async (req: Request, res: Response) => {
    try {
        const pincode = req.params.pincode?.trim();
        if (!pincode || pincode.length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pincode format'
            });
        }

        const area = await prisma.area.findFirst({
            where: {
                pincode: pincode,
                is_active: true
            },
            include: {
                district: {
                    include: {
                        state: true
                    }
                }
            }
        });

        if (area) {
            return res.json({
                success: true,
                is_serviceable: true,
                pincode,
                area: {
                    id: area.id,
                    name: area.name,
                    district: area.district.name,
                    state: area.district.state.name
                }
            });
        }

        return res.json({
            success: true,
            is_serviceable: false,
            pincode,
            message: `Snearal is not currently available at pincode ${pincode}`
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to verify pincode availability',
            error: error.message
        });
    }
});

// POST /api/v1/public/locations/pincode-waitlist
router.post('/pincode-waitlist', async (req: Request, res: Response) => {
    try {
        const { pincode, area_name, district_name, email, phone_number, user_id } = req.body;

        if (!pincode || String(pincode).trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Valid pincode is required'
            });
        }

        const cleanPincode = String(pincode).trim();

        const existing = await prisma.pincodeNotification.findFirst({
            where: {
                pincode: cleanPincode,
                OR: [
                    ...(email ? [{ email: String(email).trim().toLowerCase() }] : []),
                    ...(phone_number ? [{ phone_number: String(phone_number).trim() }] : []),
                    ...(user_id ? [{ user_id: String(user_id) }] : [])
                ]
            }
        });

        if (existing) {
            return res.json({
                success: true,
                message: "You're already on our waitlist! We'll alert you the moment we launch in your area.",
                data: existing
            });
        }

        const entry = await prisma.pincodeNotification.create({
            data: {
                pincode: cleanPincode,
                area_name: area_name || null,
                district_name: district_name || null,
                email: email ? String(email).trim().toLowerCase() : null,
                phone_number: phone_number ? String(phone_number).trim() : null,
                user_id: user_id || null,
                status: 'PENDING'
            }
        });

        return res.status(201).json({
            success: true,
            message: "Thank you! We've registered your request and will notify you when Snearal launches in your pincode.",
            data: entry
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to register pincode notification request',
            error: error.message
        });
    }
});

// GET /api/v1/public/locations/states
router.get('/states', async (_req: Request, res: Response) => {
    try {
        const states = await locationService.getAllStates();
        return res.json({
            success: true,
            data: states,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch states',
            error: error.message,
        });
    }
});

// GET /api/v1/public/locations/districts
router.get('/districts', async (req: Request, res: Response) => {
    try {
        const { state_id, has_services_only } = req.query;
        const districts = await locationService.getAllDistricts(
            state_id as string,
            false,
            has_services_only === 'true'
        );
        return res.json({
            success: true,
            data: districts,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch districts',
            error: error.message,
        });
    }
});

// GET /api/v1/public/locations/areas
router.get('/areas', async (req: Request, res: Response) => {
    try {
        const { district_id } = req.query;
        const areas = await locationService.getAllAreas(district_id as string);
        return res.json({
            success: true,
            data: areas,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch areas',
            error: error.message,
        });
    }
});

// GET /api/v1/public/locations/area/pincode/:pincode
router.get('/area/pincode/:pincode', async (req: Request, res: Response) => {
    try {
        const area = await locationService.getAreaById(req.params.pincode);
        return res.json({
            success: true,
            data: area,
        });
    } catch (error: any) {
        return res.status(404).json({
            success: false,
            message: 'Area not found',
        });
    }
});

// GET /api/v1/public/locations/hierarchy
router.get('/hierarchy', async (_req: Request, res: Response) => {
    try {
        const hierarchy = await locationService.getLocationHierarchy();
        return res.json({
            success: true,
            data: hierarchy,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch location hierarchy',
            error: error.message,
        });
    }
});

// LOCATION-BASED PRICING ENDPOINTS

// GET /api/v1/public/locations/services/pricing
router.get('/services/pricing', async (req: Request, res: Response) => {
    try {
        const { district_id, area_id } = req.query;

        if (!district_id) {
            return res.status(400).json({
                success: false,
                message: 'district_id is required',
            });
        }

        const services = await serviceLocationPricingService.getServicesWithPricing(
            district_id as string,
            area_id as string
        );

        return res.json({
            success: true,
            data: services,
            count: services.length,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch services with pricing',
            error: error.message,
        });
    }
});

// GET /api/v1/public/locations/services/:serviceId/pricing
router.get('/services/:serviceId/pricing', async (req: Request, res: Response) => {
    try {
        const { district_id, area_id } = req.query;

        const service = await serviceLocationPricingService.getServiceWithPricing(
            req.params.serviceId,
            district_id as string,
            area_id as string
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found',
            });
        }

        return res.json({
            success: true,
            data: service,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch service pricing',
            error: error.message,
        });
    }
});

// GET /api/v1/public/locations/services/:serviceId/locations
router.get('/services/:serviceId/locations', async (req: Request, res: Response) => {
    try {
        const locations = await serviceLocationPricingService.getAvailableLocationsForService(
            req.params.serviceId
        );

        return res.json({
            success: true,
            data: locations,
            count: locations.length,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch available locations',
            error: error.message,
        });
    }
});

// GET /api/v1/public/locations/services/:serviceId/compare
router.get('/services/:serviceId/compare', async (req: Request, res: Response) => {
    try {
        const comparison = await serviceLocationPricingService.comparePricesAcrossLocations(
            req.params.serviceId
        );

        return res.json({
            success: true,
            data: comparison,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to compare prices',
            error: error.message,
        });
    }
});

export default router;
