import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorHandler } from './middleware/error.middleware';
import routes from './routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

const app: Application = express();

app.use((req, _res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});

// Enhanced Security middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },
    })
);

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000', // User Frontend
    'http://localhost:3001', // Admin Dashboard
    'http://localhost:3002', // Business Partner
    'http://localhost:3003', // Service Partner
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            // Check if origin is in allowed list or is a localhost variant
            if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
        maxAge: 86400, // 24 hours
    })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(loggerMiddleware);

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10000, // practically unlimited for dev
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => req.ip === '::1' || req.ip === '127.0.0.1', // skip for localhost
});
app.use('/api/', limiter);

// Swagger UI
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Snearal API Documentation',
}));

// API Routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        message: 'Unified Backend API',
        version: '1.0.0',
        docs: '/api/v1/docs',
    });
});

// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Route not found',
        },
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
