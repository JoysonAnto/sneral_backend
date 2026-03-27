import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();
const roleController = new RoleController();

// All routes require authentication and Admin access
router.use(authenticateToken);
router.use(authorize('SUPER_ADMIN', 'ADMIN'));

// Role Management
router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.patch('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

// Permission Management
router.get('/permissions/all', roleController.getPermissions);

export default router;
