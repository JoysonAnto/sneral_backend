import { body } from 'express-validator';

export const createPartnerValidator = [
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .optional(),
    body('fullName')
        .optional()
        .trim(),
    body('partnerName')
        .optional()
        .trim(),
    body('phoneNumber')
        .optional(),
    body('mobileNumber')
        .optional(),
    body('services')
        .optional()
        .isArray()
        .withMessage('Services must be an array'),
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
    body('isOnHold')
        .optional()
        .isBoolean(),
    body('is_on_hold')
        .optional(),
    body('holdReason')
        .optional(),
    body('hold_reason')
        .optional(),
    body('isBlacklisted')
        .optional()
        .isBoolean(),
    body('is_blacklisted')
        .optional(),
    body('blacklistReason')
        .optional(),
    body('blacklist_reason')
        .optional(),
    body('strikeCount')
        .optional()
        .isInt({ min: 0 }),
    body('strike_count')
        .optional(),
    body('adminRemarks')
        .optional(),
    body('admin_remarks')
        .optional(),
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
