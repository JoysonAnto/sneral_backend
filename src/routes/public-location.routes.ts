import { Router, Request, Response } from 'express';
import { serviceLocationPricingService } from '../services/service-location-pricing.service';
import locationService from '../services/location.service';

const router = Router();

// PUBLIC ENDPOINTS - No authentication required for browsing

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
