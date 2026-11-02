import { body, param } from 'express-validator';

export const createCouponValidator = [
    body('code')
        .notEmpty()
        .withMessage('Coupon code is required')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Coupon code must be between 3 and 30 characters')
        .matches(/^[A-Za-z0-9_-]+$/)
        .withMessage('Coupon code must contain only letters, numbers, hyphens, and underscores'),
    body('name')
        .notEmpty()
        .withMessage('Coupon name is required')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Coupon name must be between 2 and 100 characters'),
    body('description')
        .optional()
        .trim(),
    body('discountType')
        .notEmpty()
        .withMessage('Discount type is required')
        .isIn(['FIXED', 'PERCENTAGE'])
        .withMessage('Discount type must be either FIXED or PERCENTAGE'),
    body('discountValue')
        .notEmpty()
        .withMessage('Discount value is required')
        .isFloat({ min: 0.01 })
        .withMessage('Discount value must be greater than 0'),
    body('maxDiscount')
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage('Maximum discount must be a positive number'),
    body('minOrderAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum order amount must be 0 or greater'),
    body('startDate')
        .notEmpty()
        .withMessage('Start date is required')
        .isISO8601()
        .withMessage('Start date must be a valid ISO8601 date'),
    body('expiryDate')
        .notEmpty()
        .withMessage('Expiry date is required')
        .isISO8601()
        .withMessage('Expiry date must be a valid ISO8601 date'),
    body('totalUsageLimit')
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage('Total usage limit must be a positive integer'),
    body('perUserUsageLimit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Per user usage limit must be at least 1'),
    body('newUserOnly')
        .optional()
        .isBoolean()
        .withMessage('newUserOnly must be a boolean'),
    body('applicableServices')
        .optional()
        .isArray()
        .withMessage('applicableServices must be an array of service IDs'),
    body('termsConditions')
        .optional()
        .trim(),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
];

export const updateCouponValidator = [
    param('id').isUUID().withMessage('Invalid coupon ID'),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Coupon name must be between 2 and 100 characters'),
    body('description')
        .optional()
        .trim(),
    body('discountType')
        .optional()
        .isIn(['FIXED', 'PERCENTAGE'])
        .withMessage('Discount type must be either FIXED or PERCENTAGE'),
    body('discountValue')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Discount value must be greater than 0'),
    body('maxDiscount')
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage('Maximum discount must be a positive number'),
    body('minOrderAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum order amount must be 0 or greater'),
    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO8601 date'),
    body('expiryDate')
        .optional()
        .isISO8601()
        .withMessage('Expiry date must be a valid ISO8601 date'),
    body('totalUsageLimit')
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage('Total usage limit must be a positive integer'),
    body('perUserUsageLimit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Per user usage limit must be at least 1'),
    body('newUserOnly')
        .optional()
        .isBoolean()
        .withMessage('newUserOnly must be a boolean'),
    body('applicableServices')
        .optional()
        .isArray()
        .withMessage('applicableServices must be an array of service IDs'),
    body('termsConditions')
        .optional()
        .trim(),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
];

export const validateCouponValidator = [
    body('code')
        .notEmpty()
        .withMessage('Coupon code is required')
        .trim(),
    body('amount')
        .notEmpty()
        .withMessage('Order amount is required')
        .isFloat({ min: 1 })
        .withMessage('Order amount must be greater than 0'),
    body('serviceId')
        .optional()
        .isUUID()
        .withMessage('Invalid service ID format'),
];
