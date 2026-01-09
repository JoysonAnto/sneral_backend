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
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        // Verify token
        const decoded = verifyAccessToken(token);

        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.role = decoded.role;
        socket.email = decoded.email;

        logger.info(`Socket authenticated: ${decoded.email} (${decoded.role})`);
        next();
    } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication error: Invalid token'));
    }
};
