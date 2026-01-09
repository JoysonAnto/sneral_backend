import { body } from 'express-validator';

export const createPartnerValidator = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long'),
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required'),
    body('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Please provide a valid phone number'),
    body('services')
        .optional()
        .isArray()
        .withMessage('Services must be an array'),
    body('services.*')
        .optional()
        .isUUID()
        .withMessage('Invalid service ID'),
];

export const updatePartnerValidator = [
    body('fullName')
        .optional()
        .trim()
        .notEmpty(),
    body('phoneNumber')
        .optional()
        .isMobilePhone('any'),
    body('serviceRadius')
        .optional()
        .isFloat({ min: 1, max: 50 })
        .withMessage('Service radius must be between 1 and 50 km'),
];

export const updateAvailabilityValidator = [
    body('isAvailable')
        .notEmpty()
        .withMessage('Availability status is required')
        .isBoolean()
        .withMessage('isAvailable must be a boolean'),
    body('latitude')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid latitude'),
    body('longitude')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid longitude'),
];

export const updatePartnerServiceValidator = [
    body('serviceId')
        .notEmpty()
        .withMessage('Service ID is required')
        .isUUID(),
    body('customPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Custom price must be a positive number'),
    body('isAvailable')
        .optional()
        .isBoolean()
        .withMessage('isAvailable must be a boolean'),
];
