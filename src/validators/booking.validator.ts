import { body, param } from 'express-validator';

export const createBookingValidator = [
    body('serviceId')
        .notEmpty()
        .withMessage('Service ID is required')
        .isUUID()
        .withMessage('Invalid service ID'),
    body('scheduledDate')
        .notEmpty()
        .withMessage('Scheduled date is required')
        .isISO8601()
        .withMessage('Invalid date format'),
    body('scheduledTime')
        .notEmpty()
        .withMessage('Scheduled time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Invalid time format (use HH:mm)'),
    body('serviceAddress')
        .notEmpty()
        .withMessage('Service address is required')
        .trim(),
    body('serviceLatitude')
        .notEmpty()
        .withMessage('Service latitude is required')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid latitude'),
    body('serviceLongitude')
        .notEmpty()
        .withMessage('Service longitude is required')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid longitude'),
    body('paymentMethod')
        .optional()
        .isIn(['CASH', 'CARD', 'UPI', 'WALLET', 'NET_BANKING'])
        .withMessage('Invalid payment method'),
    body('specialInstructions')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Special instructions too long (max 500 characters)'),
];

export const updateBookingStatusValidator = [
    param('id')
        .isUUID()
        .withMessage('Invalid booking ID'),
    body('status')
        .notEmpty()
        .withMessage('Status is required')
        .isIn([
            'PENDING',
            'SEARCHING_PARTNER',
            'PARTNER_ASSIGNED',
            'PARTNER_ACCEPTED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED',
            'RATED',
        ])
        .withMessage('Invalid status'),
    body('notes')
        .optional()
        .trim(),
];

export const assignPartnerValidator = [
    param('id')
        .isUUID()
        .withMessage('Invalid booking ID'),
    body('partnerId')
        .notEmpty()
        .withMessage('Partner ID is required')
        .isUUID()
        .withMessage('Invalid partner ID'),
];

export const cancelBookingValidator = [
    param('id')
        .isUUID()
        .withMessage('Invalid booking ID'),
    body('reason')
        .notEmpty()
        .withMessage('Cancellation reason is required')
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage('Reason must be between 10 and 500 characters'),
];

export const rateBookingValidator = [
    param('id')
        .isUUID()
        .withMessage('Invalid booking ID'),
    body('rating')
        .notEmpty()
        .withMessage('Rating is required')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be between 1 and 5'),
    body('review')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Review too long (max 1000 characters)'),
];
