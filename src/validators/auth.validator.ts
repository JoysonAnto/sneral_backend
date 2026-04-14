import { body } from 'express-validator';

// Safe email normaliser: only lowercases and trims — does NOT strip dots or subaddresses.
// express-validator's normalizeEmail() strips dots from Gmail addresses (e.g. john.doe@gmail.com
// becomes johndoe@gmail.com), which causes lookups to fail for users who registered with dots.
const safeEmail = () =>
    body('email')
        .optional()
        .trim()
        .customSanitizer((val: string) => (typeof val === 'string' ? val.toLowerCase().trim() : val))
        .isEmail()
        .withMessage('Please provide a valid email');

const requiredEmail = () =>
    body('email')
        .trim()
        .customSanitizer((val: string) => (typeof val === 'string' ? val.toLowerCase().trim() : val))
        .isEmail()
        .withMessage('Please provide a valid email');

export const registerValidator = [
    safeEmail(),
    body('password')
        .optional()
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long'),
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2 })
        .withMessage('Full name must be at least 2 characters long'),
    body('phoneNumber')
        .optional()
        .isMobilePhone('any')
        .withMessage('Please provide a valid phone number'),
    body('role')
        .optional()
        .isIn(['CUSTOMER', 'SERVICE_PARTNER', 'BUSINESS_PARTNER'])
        .withMessage('Invalid role'),
    body('categoryId')
        .optional()
        .isString()
        .withMessage('Invalid categoryId'),
    body('businessName')
        .optional()
        .trim(),
    body('businessType')
        .optional()
        .trim(),
];

export const loginValidator = [
    safeEmail(),
    body('phoneNumber')
        .optional()
        .isMobilePhone('any')
        .withMessage('Please provide a valid phone number'),
    body('password')
        .optional(),
];

export const verifyEmailValidator = [
    requiredEmail(),
    body('otp')
        .isLength({ min: 6, max: 6 })
        .withMessage('OTP must be 6 digits')
        .isNumeric()
        .withMessage('OTP must contain only numbers'),
];

export const refreshTokenValidator = [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required'),
];

export const forgotPasswordValidator = [
    requiredEmail(),
];

export const resetPasswordValidator = [
    requiredEmail(),
    body('otp')
        .isLength({ min: 6, max: 6 })
        .withMessage('OTP must be 6 digits')
        .isNumeric()
        .withMessage('OTP must contain only numbers'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];

export const changePasswordValidator = [
    body('oldPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];
