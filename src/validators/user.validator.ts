import { body } from 'express-validator';

export const createAdminValidator = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required'),
    body('phoneNumber')
        .optional()
        .trim(),
    body('phone_number')
        .optional()
        .trim(),
    body('role')
        .optional()
        .isIn(['ADMIN', 'SUPER_ADMIN'])
        .withMessage('Role must be ADMIN or SUPER_ADMIN'),
    body('roleId')
        .optional(),
    body('role_id')
        .optional(),
];

export const updateUserValidator = [
    body('fullName')
        .optional()
        .trim(),
    body('full_name')
        .optional()
        .trim(),
    body('phoneNumber')
        .optional()
        .trim(),
    body('phone_number')
        .optional()
        .trim(),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail(),
    body('isActive')
        .optional()
        .isBoolean(),
    body('is_active')
        .optional()
        .isBoolean(),
    body('role')
        .optional()
        .isIn(['ADMIN', 'SUPER_ADMIN', 'CUSTOMER', 'SERVICE_PARTNER', 'BUSINESS_PARTNER']),
    body('roleId')
        .optional(),
    body('role_id')
        .optional(),
    body('password')
        .optional()
        .isLength({ min: 6 }),
];
