import { body } from 'express-validator';

export const createAdminValidator = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required'),
    body('role')
        .optional()
        .isIn(['ADMIN', 'SUPER_ADMIN'])
        .withMessage('Role must be ADMIN or SUPER_ADMIN'),
];

export const updateUserValidator = [
    body('fullName')
        .optional()
        .trim()
        .notEmpty(),
    body('phoneNumber')
        .optional()
        .isMobilePhone('any'),
    body('isActive')
        .optional()
        .isBoolean(),
];
