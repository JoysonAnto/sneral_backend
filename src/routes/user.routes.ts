import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateToken, checkPermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAdminValidator, updateUserValidator } from '../validators/user.validator';

const router = Router();
const userController = new UserController();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and administrative operations
 */

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/', checkPermission('USER_VIEW'), userController.getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id', checkPermission('USER_VIEW'), userController.getUserById);

/**
 * @swagger
 * /users/admin:
 *   post:
 *     summary: Create an admin user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, SUPER_ADMIN]
 *     responses:
 *       201:
 *         description: Admin user created
 */
router.post(
    '/admin',
    checkPermission('ROLE_MANAGE'),
    validate(createAdminValidator),
    userController.createAdmin
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 */
router.patch('/:id', checkPermission('USER_MANAGE'), validate(updateUserValidator), userController.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 */
router.delete('/:id', checkPermission('ROLE_MANAGE'), userController.deleteUser);

export default router;
