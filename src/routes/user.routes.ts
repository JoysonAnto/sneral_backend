import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAdminValidator, updateUserValidator } from '../validators/user.validator';

const router = Router();
const userController = new UserController();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// List all users
router.get('/', userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Create admin (SUPER_ADMIN only)
router.post(
    '/admin',
    authorize('SUPER_ADMIN'),
    validate(createAdminValidator),
    userController.createAdmin
);

// Update user
router.patch('/:id', validate(updateUserValidator), userController.updateUser);

// Delete user (SUPER_ADMIN only)
router.delete('/:id', authorize('SUPER_ADMIN'), userController.deleteUser);

export default router;
