import { Request, Response } from 'express';
import LocationService from '../services/location.service';
import { asyncHandler } from '../middleware/async.middleware';

export class LocationController {
    // ====================
    // STATE ENDPOINTS
    // ====================

    getAllStates = asyncHandler(async (req: Request, res: Response) => {
        const includeInactive = req.query.includeInactive === 'true';
        const states = await LocationService.getAllStates(includeInactive);

        res.status(200).json({
            success: true,
            data: states,
        });
    });

    getStateById = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const state = await LocationService.getStateById(id);

        res.status(200).json({
            success: true,
            data: state,
        });
    });

    createState = asyncHandler(async (req: Request, res: Response) => {
        const { name, code } = req.body;
        const state = await LocationService.createState({ name, code });

        res.status(201).json({
            success: true,
            message: 'State created successfully',
            data: state,
        });
    });

    updateState = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const state = await LocationService.updateState(id, req.body);

        res.status(200).json({
            success: true,
            message: 'State updated successfully',
            data: state,
        });
    });

    // ====================
    // DISTRICT ENDPOINTS
    // ====================

    getAllDistricts = asyncHandler(async (req: Request, res: Response) => {
        const stateId = req.query.stateId as string | undefined;
        const includeInactive = req.query.includeInactive === 'true';
        const districts = await LocationService.getAllDistricts(stateId, includeInactive);

        res.status(200).json({
            success: true,
            data: districts,
        });
    });

    getDistrictById = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const district = await LocationService.getDistrictById(id);

        res.status(200).json({
            success: true,
            data: district,
        });
    });

    createDistrict = asyncHandler(async (req: Request, res: Response) => {
        const { stateId, name } = req.body;
        const district = await LocationService.createDistrict({ stateId, name });

        res.status(201).json({
            success: true,
            message: 'District created successfully',
            data: district,
        });
    });

    updateDistrict = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const district = await LocationService.updateDistrict(id, req.body);

        res.status(200).json({
            success: true,
            message: 'District updated successfully',
            data: district,
        });
    });

    // ====================
    // AREA ENDPOINTS
    // ====================

    getAllAreas = asyncHandler(async (req: Request, res: Response) => {
        const districtId = req.query.districtId as string | undefined;
        const includeInactive = req.query.includeInactive === 'true';
        const areas = await LocationService.getAllAreas(districtId, includeInactive);

        res.status(200).json({
            success: true,
            data: areas,
        });
    });

    getAreaById = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const area = await LocationService.getAreaById(id);

        res.status(200).json({
            success: true,
            data: area,
        });
    });

    createArea = asyncHandler(async (req: Request, res: Response) => {
        const { districtId, name, pincode } = req.body;
        const area = await LocationService.createArea({ districtId, name, pincode });

        res.status(201).json({
            success: true,
            message: 'Area created successfully',
            data: area,
        });
    });

    updateArea = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const area = await LocationService.updateArea(id, req.body);

        res.status(200).json({
            success: true,
            message: 'Area updated successfully',
            data: area,
        });
    });

    // ====================
    // HIERARCHY ENDPOINT
    // ====================

    getLocationHierarchy = asyncHandler(async (req: Request, res: Response) => {
        const hierarchy = await LocationService.getLocationHierarchy();

        res.status(200).json({
            success: true,
            data: hierarchy,
        });
    });
}

export default new LocationController();
