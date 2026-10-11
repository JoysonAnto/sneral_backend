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
        .trim(),
    body('phoneNumber')
        .optional(),
    body('serviceRadius')
        .optional()
        .isFloat({ min: 1, max: 100 })
        .withMessage('Service radius must be between 1 and 100 km'),
    body('businessName')
        .optional()
        .trim(),
    body('businessType')
        .optional()
        .trim(),
    body('gstNumber')
        .optional()
        .trim(),
    body('commissionRate')
        .optional()
        .isFloat({ min: 0, max: 1 }),
    body('kycStatus')
        .optional()
        .isIn(['PENDING', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED']),
    body('availabilityStatus')
        .optional()
        .isIn(['AVAILABLE', 'BUSY', 'OFFLINE']),
    body('bankAccountNumber')
        .optional()
        .trim(),
    body('bankIfscCode')
        .optional()
        .trim(),
    body('bankAccountName')
        .optional()
        .trim(),
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
