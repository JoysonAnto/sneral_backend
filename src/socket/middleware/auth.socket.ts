import { Socket } from 'socket.io';
import { verifyAccessToken } from '../../utils/jwt.helper';
import logger from '../../utils/logger';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    role?: string;
    email?: string;
}

export const authenticateSocket = async (
    socket: AuthenticatedSocket,
    next: (err?: Error) => void
) => {
    try {
        let token = socket.handshake.auth?.token ||
            socket.handshake.auth?.accessToken ||
            socket.handshake.headers.authorization;

        if (!token) {
            logger.warn(`Socket connection attempt without token from ${socket.id}`);
            return next(new Error('Authentication error: No token provided'));
        }

        // Handle stringified objects or Bearer prefix
        if (typeof token === 'string' && token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        // Verify token
        const decoded = verifyAccessToken(token);

        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.role = decoded.role;
        socket.email = decoded.email;

        logger.info(`Socket authenticated: ${decoded.email} (${decoded.role}) for socket ${socket.id}`);
        next();
    } catch (error: any) {
        logger.error(`Socket authentication error for socket ${socket.id}: ${error.message}`);
        // Log the first few chars of token for debugging (safety first)
        const rawToken = socket.handshake.auth?.token || socket.handshake.headers.authorization;
        if (rawToken) {
            logger.debug(`Received token starting with: ${String(rawToken).substring(0, 15)}...`);
        }
        next(new Error('Authentication error: Invalid token'));
    }
};
