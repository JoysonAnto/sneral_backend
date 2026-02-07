import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: [
                'http://localhost:3000', // User Frontend
                'http://localhost:3001', // Admin Dashboard
                'http://localhost:3002', // Business Partner
                'http://localhost:3003', // Service Partner
            ],
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        console.log(`✅ Socket connected: ${socket.id}`);

        // Join room based on user role
        socket.on('join:admin', () => {
            socket.join('admin');
            console.log(`✅ Admin joined room: ${socket.id}`);
        });

        socket.on('join:customer', (customerId: string) => {
            socket.join(`customer:${customerId}`);
            console.log(`✅ Customer ${customerId} joined room: ${socket.id}`);
        });

        socket.on('join:partner', (partnerId: string) => {
            socket.join(`partner:${partnerId}`);
            console.log(`✅ Partner ${partnerId} joined room: ${socket.id}`);
        });

        socket.on('disconnect', () => {
            console.log(`❌ Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = (): SocketIOServer => {
    if (!io) {
        throw new Error('Socket.io not initialized. Call initializeSocket first.');
    }
    return io;
};
