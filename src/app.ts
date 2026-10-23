import express, { Application } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorHandler } from './middleware/error.middleware';
import routes from './routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { corsOptions } from './config/cors';

const app: Application = express();

// Trust proxy for rate limiter to work correctly behind proxies like Render/Railway/Cloudflare
app.set('trust proxy', 1);

app.use((req, _res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});

// 1. CORS Configuration (MUST precede Helmet and routes)
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 2. Enhanced Security middleware for Production (configured for Cross-Origin APIs)
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginOpenerPolicy: false,
        contentSecurityPolicy: false,
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

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
// app.use(compression()); // Temporarily disable to see if it helps debugging

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

// Static uploads serving (KYC docs, service photos, invoices)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/v1/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Swagger UI & JSON Spec
app.get('/api/v1/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Snearal API Documentation',
}));

// API Routes
app.use('/api/v1', routes);

// Root health endpoint (for Railway / cloud platform liveness probes)
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        message: 'Unified Backend API',
        version: '1.0.0',
        docs: '/api/v1/docs',
    });
});

// Sentry debug endpoint for testing error capturing
app.get('/debug-sentry', (_req, _res) => {
    throw new Error('My first Sentry error!');
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
