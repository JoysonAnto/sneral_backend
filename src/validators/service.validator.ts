import { body } from 'express-validator';

export const createServiceValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Service name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Service name must be between 3 and 100 characters'),
    body('description')
        .trim()
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
    body('categoryId')
        .notEmpty()
        .withMessage('Category ID is required')
        .isUUID()
        .withMessage('Invalid category ID'),
    body('basePrice')
        .notEmpty()
        .withMessage('Base price is required')
        .isFloat({ min: 0 })
        .withMessage('Base price must be a positive number'),
    body('duration')
        .notEmpty()
        .withMessage('Duration is required')
        .isInt({ min: 1 })
        .withMessage('Duration must be a positive integer (minutes)'),
    body('imageUrl')
        .optional()
        .isURL()
        .withMessage('Invalid image URL'),
];

export const updateServiceValidator = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Service name must be between 3 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
    body('categoryId')
        .optional()
        .isUUID()
        .withMessage('Invalid category ID'),
    body('basePrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Base price must be a positive number'),
    body('duration')
        .optional()
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
        .optional()
        .isURL()
        .withMessage('Invalid icon URL'),
];
