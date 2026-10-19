import cors from 'cors';
import logger from '../utils/logger';

/**
 * Check if a request origin is allowed cross-origin access.
 * Supports Vercel preview/production domains, Railway domains, Snearal custom domains,
 * and environment-configured CORS_ORIGINS.
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
    // Requests with no origin (like mobile apps, curl, server-to-server) are allowed
    if (!origin) return true;

    // In development or if explicitly wildcarded, allow all
    if (process.env.NODE_ENV === 'development' || process.env.CORS_ORIGINS === '*') {
        return true;
    }

    // Split and clean environment origins (e.g. "https://snearal.vercel.app, https://admin.snearal.com")
    const envOrigins = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((o) => o.trim().toLowerCase().replace(/\/$/, ''))
        .filter(Boolean);

    const normalizedOrigin = origin.trim().toLowerCase().replace(/\/$/, '');

    // 1. Direct match with configured env origins
    if (envOrigins.includes(normalizedOrigin)) {
        return true;
    }

    // 2. Default local development origins
    if (
        normalizedOrigin.startsWith('http://localhost:') ||
        normalizedOrigin.startsWith('http://127.0.0.1:')
    ) {
        return true;
    }

    try {
        const url = new URL(origin);
        const hostname = url.hostname.toLowerCase();

        // 3. Automatically allow all Vercel deployments (*.vercel.app)
        // This covers production and all dynamic git branch / preview deployments
        if (hostname.endsWith('.vercel.app')) {
            return true;
        }

        // 4. Automatically allow Railway deployments
        if (hostname.endsWith('.railway.app') || hostname.endsWith('.up.railway.app')) {
            return true;
        }

        // 5. Automatically allow Snearal domains (*.snearal.com, snearal.com)
        if (hostname === 'snearal.com' || hostname.endsWith('.snearal.com')) {
            return true;
        }

        // 6. Allow Cloudflare tunnels
        if (hostname.endsWith('.trycloudflare.com')) {
            return true;
        }
    } catch {
        // Fallback for non-standard origins
    }

    return false;
};

export const corsOptions: cors.CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            logger.warn(`❌ [CORS] Origin rejected: ${origin}`);
            // Returning false cleanly omits Access-Control-Allow-Origin without throwing a 500 error
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'Pragma',
        'sentry-trace',
        'baggage',
        'ngrok-skip-browser-warning',
        'x-client-id',
        'x-api-version',
        'x-refresh-token',
    ],
    exposedHeaders: [
        'Authorization',
        'Content-Range',
        'X-Total-Count',
        'X-Refresh-Token',
        'Content-Disposition',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours preflight caching
    optionsSuccessStatus: 204,
};

export default corsOptions;
