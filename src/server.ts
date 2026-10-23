// Restart trigger: 2026-04-25T09:25
import 'dotenv/config';
import { initializeSentry } from './config/sentry';
initializeSentry();
import http from 'http';
import app from './app';
import { logger } from './utils/logger';
import prisma from './config/database';
import { connectRedis } from './config/redis';
import { initializeSocket } from './socket/socket.server';
import { cronService } from './services/cron.service';
import { initializeFirebase } from './config/firebase';

// Initialize Firebase Admin SDK as early as possible
initializeFirebase();

const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO with HTTP server
initializeSocket(httpServer);

async function startServer() {
    try {
        // 1. Start server IMMEDIATELY on 0.0.0.0 so Railway / container health probes pass instantly
        httpServer.listen(Number(PORT), '0.0.0.0', () => {
            logger.info(`🚀 Server running on port ${PORT} at http://0.0.0.0:${PORT}`);
            logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // 2. Connect to database (with warning instead of process crash)
        try {
            await prisma.$connect();
            logger.info('✅ Database connected successfully');
        } catch (dbError) {
            logger.warn('⚠️ Database connection warning during startup, will connect on demand:', dbError);
        }

        // 3. Connect to Redis (optional, continues if fails)
        try {
            await connectRedis();
        } catch (redisError) {
            logger.warn('⚠️ Redis connection failed, continuing without cache');
        }

        // 4. Start cron jobs
        try {
            cronService.start();
            logger.info('✅ Cron service started');
        } catch (cronError) {
            logger.warn('⚠️ Cron service failed to start:', cronError);
        }

        // 5. Seed default platform settings (commission, GST) — idempotent
        try {
            const { PlatformSettingsService } = await import('./services/platform-settings.service');
            await new PlatformSettingsService().seedDefaults();
            logger.info('✅ Platform settings ready');
        } catch (settingsError) {
            logger.warn('⚠️ Could not seed platform settings:', settingsError);
        }
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    cronService.stop();
    httpServer.close(async () => {
        logger.info('HTTP server closed');
        await prisma.$disconnect();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('SIGINT signal received: closing HTTP server');
    cronService.stop();
    httpServer.close(async () => {
        logger.info('HTTP server closed');
        await prisma.$disconnect();
        process.exit(0);
    });
});

startServer();
 
