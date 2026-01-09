import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from '../utils/logger';

export const initializeSentry = () => {
    const sentryDsn = process.env.SENTRY_DSN;

    if (!sentryDsn) {
        logger.warn('Sentry DSN not configured, error tracking disabled');
        return;
    }

    Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || 'development',

        // Set sample rate for performance monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Set sample rate for profiling
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        integrations: [
            nodeProfilingIntegration(),
        ],

        // Filter out sensitive data
        beforeSend(event) {
            // Remove sensitive headers
            if (event.request?.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
            }

            return event;
        },
    });

    logger.info('Sentry initialized successfully');
};

export { Sentry };
