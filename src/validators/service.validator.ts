import { body } from 'express-validator';

export const createServiceValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Service name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Service name must be between 2 and 100 characters'),
    body('description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must be under 1000 characters'),
    body('categoryId')
        .optional({ checkFalsy: true })
        .isUUID()
        .withMessage('Invalid category ID'),
    body('basePrice')
        .notEmpty()
        .withMessage('Base price is required')
        .isFloat({ min: 0 })
        .withMessage('Base price must be a positive number'),
    body('duration')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage('Duration must be a positive integer (minutes)'),
    body('imageUrl')
        .optional({ checkFalsy: true })
        .isURL()
        .withMessage('Invalid image URL'),
];

export const updateServiceValidator = [
    body('name')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Service name must be between 2 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must be under 1000 characters'),
    body('categoryId')
        .optional({ checkFalsy: true })
        .isUUID()
        .withMessage('Invalid category ID'),
    body('basePrice')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 })
        .withMessage('Base price must be a positive number'),
    body('duration')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage('Duration must be a positive integer'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
];

export const createCategoryValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Category name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Category name must be between 2 and 50 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description too long'),
    body('iconUrl')
        .optional({ checkFalsy: true })
        .isURL()
        .withMessage('Invalid icon URL'),
];
