import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

// Rate limiter for registration
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour
    message: 'Too many accounts created from this IP, please try again after an hour',
});

// Rate limiter for payment endpoints
export const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 payment requests per 15 minutes
    message: 'Too many payment requests, please try again later',
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Too many file uploads, please try again later',
});

// General API rate limiter (already exists in app.ts)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later',
});

// Public endpoints (less strict)
export const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests, please try again later',
});

// OTP/verification requests
export const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3, // 3 OTP requests per 15 minutes
    message: 'Too many OTP requests, please try again later',
});
