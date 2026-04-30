import { body, param, query } from 'express-validator';

export const submitReviewValidator = [
    param('id').isUUID().withMessage('Invalid booking ID'),
    body('rating')
        .notEmpty().withMessage('Rating is required')
        .isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
    body('comment')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 }).withMessage('Comment must be at most 1000 characters'),
    body('type')
        .notEmpty().withMessage('Review type is required')
        .isIn(['CUSTOMER_TO_PARTNER', 'PARTNER_TO_CUSTOMER'])
        .withMessage('type must be CUSTOMER_TO_PARTNER or PARTNER_TO_CUSTOMER'),
];

export const listReviewsValidator = [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];
