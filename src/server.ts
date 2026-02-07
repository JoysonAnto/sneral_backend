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

const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO with HTTP server
initializeSocket(httpServer);

async function startServer() {
    try {
        // Connect to database
        await prisma.$connect();
        logger.info('✅ Database connected successfully');

        // Connect to Redis (optional, continues if fails)
        try {
            await connectRedis();
        } catch (redisError) {
            logger.warn('⚠️ Redis connection failed, continuing without cache');
        }

        // Start cron jobs
        cronService.start();
        logger.info('✅ Cron service started');

        // Start server
        httpServer.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
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
