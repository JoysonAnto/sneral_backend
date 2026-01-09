import { Router } from 'express';
import LocationController from '../controllers/location.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

// All location routes require authentication and admin role
router.use(authenticateToken);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// States
router.get('/states', LocationController.getAllStates);
router.get('/states/:id', LocationController.getStateById);
router.post('/states', LocationController.createState);
router.put('/states/:id', LocationController.updateState);

// Districts
router.get('/districts', LocationController.getAllDistricts);
router.get('/districts/:id', LocationController.getDistrictById);
router.post('/districts', LocationController.createDistrict);
router.put('/districts/:id', LocationController.updateDistrict);

// Areas
router.get('/areas', LocationController.getAllAreas);
router.get('/areas/:id', LocationController.getAreaById);
router.post('/areas', LocationController.createArea);
router.put('/areas/:id', LocationController.updateArea);

// Hierarchy
router.get('/hierarchy', LocationController.getLocationHierarchy);

export default router;
