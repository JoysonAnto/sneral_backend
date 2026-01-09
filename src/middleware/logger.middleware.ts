import morgan from 'morgan';
import { logger } from '../utils/logger';

// Create a stream object with a 'write' function that will be used by morgan
const stream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

// Skip logging during tests
const skip = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'test';
};

// Build the morgan middleware
export const loggerMiddleware = morgan(
    ':remote-addr :method :url :status :res[content-length] - :response-time ms',
    { stream, skip }
);
