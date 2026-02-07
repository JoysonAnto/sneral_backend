import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { authenticateSocket } from './middleware/auth.socket';
import { setupBookingHandlers } from './handlers/booking.handler';
import { setupMessageHandlers } from './handlers/message.handler';
import { setupNotificationHandlers } from './handlers/notification.handler';
import logger from '../utils/logger';

let io: SocketIOServer;

export const initializeSocket = (server: HTTPServer) => {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000', // User Frontend
        'http://localhost:3001', // Admin Dashboard
        'http://localhost:3002', // Business Partner
        'http://localhost:3003', // Service Partner
    ];

    io = new SocketIOServer(server, {
        cors: {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);

                // Check if origin is in allowed list or is a localhost variant
                if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            },
            credentials: true,
            methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
    });

    // Apply authentication middleware to all namespaces
    io.of('/customer').use(authenticateSocket);
    io.of('/partner').use(authenticateSocket);
    io.of('/admin').use(authenticateSocket);

    // Setup event handlers
    setupBookingHandlers(io);
    setupMessageHandlers(io);
    setupNotificationHandlers(io);

    // Connection logging
    io.on('connection', (socket) => {
        logger.info(`New socket connection: ${socket.id}`);
    });

    // Namespace-specific connection logging
    io.of('/customer').on('connection', (socket: any) => {
        logger.info(`Customer namespace - User ${socket.userId} connected`);
        socket.join(`customer:${socket.userId}`);

        socket.on('disconnect', (reason: string) => {
            logger.info(`Customer ${socket.userId} disconnected: ${reason}`);
        });
    });

    io.of('/partner').on('connection', (socket: any) => {
        logger.info(`Partner namespace - User ${socket.userId} connected`);
        socket.join(`partner:${socket.userId}`);

        socket.on('disconnect', (reason: string) => {
            logger.info(`Partner ${socket.userId} disconnected: ${reason}`);
        });
    });

    io.of('/admin').on('connection', (socket: any) => {
        logger.info(`Admin namespace - User ${socket.userId} connected`);
        socket.join('admin');
        socket.join(`admin:${socket.userId}`);

        // Send real-time stats on connection
        socket.on('request:stats', async () => {
            // Import AdminService
            const { AdminService } = await import('../services/admin.service');
            const adminService = new AdminService();

            try {
                const stats = await adminService.getDashboardStats();
                socket.emit('dashboard:stats_update', stats);
            } catch (error) {
                logger.error('Error fetching stats for admin:', error);
            }
        });

        socket.on('disconnect', (reason: string) => {
            logger.info(`Admin ${socket.userId} disconnected: ${reason}`);
        });
    });

    logger.info('Socket.IO initialized with namespaces: /customer, /partner, /admin');

    return io;
};

export const getIO = (): SocketIOServer => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
};

export default {
    initializeSocket,
    getIO,
};
