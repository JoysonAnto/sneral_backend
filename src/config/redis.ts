import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Check if Redis should be enabled
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

let redisClient: Redis | null = null;

if (REDIS_ENABLED) {
    const redisOptions: any = {
        retryStrategy: (times: number) => {
            // Stop retrying after 3 attempts
            if (times > 3) {
                logger.warn('Redis connection failed after 3 attempts. Running without Redis cache.');
                return null; // Stop retrying
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true, // Don't connect immediately
        enableOfflineQueue: false, // Don't queue commands when offline
    };

    if (process.env.REDIS_URL) {
        redisClient = new Redis(process.env.REDIS_URL, redisOptions);
    } else {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            ...redisOptions
        });
    }

    redisClient.on('connect', () => {
        logger.info('✅ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
        // Only log once, not continuously
        if ((err as any).code === 'ECONNREFUSED') {
            logger.warn('⚠️ Redis not available - running without cache (graceful degradation)');
        } else {
            logger.error('Redis connection error:', err);
        }
    });

    redisClient.on('ready', () => {
        logger.info('✅ Redis is ready to accept commands');
    });

    // Try to connect but don't fail if it doesn't work
    redisClient.connect().catch((err) => {
        logger.warn('⚠️ Redis connection failed - continuing without cache:', err.message);
        redisClient = null; // Disable Redis
    });

    // Graceful shutdown
    process.on('beforeExit', async () => {
        if (redisClient) {
            await redisClient.quit();
            logger.info('Redis disconnected');
        }
    });
} else {
    logger.info('ℹ️ Redis disabled - running without cache');
}

// Helper function to safely use Redis
export async function getRedisValue(key: string): Promise<string | null> {
    if (!redisClient) return null;
    try {
        return await redisClient.get(key);
    } catch (error) {
        logger.warn('Redis get failed, continuing without cache');
        return null;
    }
}

export async function setRedisValue(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!redisClient) return false;
    try {
        if (ttl) {
            await redisClient.setex(key, ttl, value);
        } else {
            await redisClient.set(key, value);
        }
        return true;
    } catch (error) {
        logger.warn('Redis set failed, continuing without cache');
        return false;
    }
}

export async function deleteRedisValue(key: string): Promise<boolean> {
    if (!redisClient) return false;
    try {
        await redisClient.del(key);
        return true;
    } catch (error) {
        logger.warn('Redis delete failed, continuing without cache');
        return false;
    }
}

export const connectRedis = async (): Promise<void> => {
    // Connection is handled automatically above
    logger.info('Redis connection manager initialized');
};

export default redisClient;
