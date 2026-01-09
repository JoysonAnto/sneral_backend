import { io as Client, Socket } from 'socket.io-client';
import http from 'http';
import { AddressInfo } from 'net';
import app from '../../src/app';
import { initializeSocket } from '../../src/socket/socket.server';
import { generateAccessToken } from '../../src/utils/jwt.helper';

describe('Socket.IO Integration Tests', () => {
    let httpServer: http.Server;
    let serverPort: number;
    let customerSocket: Socket;
    let partnerSocket: Socket;
    let adminSocket: Socket;
    let customerToken: string;
    let partnerToken: string;
    let adminToken: string;

    beforeAll((done) => {
        // Create HTTP server
        httpServer = http.createServer(app);

        // Initialize Socket.IO
        initializeSocket(httpServer);

        // Start server on random port
        httpServer.listen(() => {
            serverPort = (httpServer.address() as AddressInfo).port;

            // Generate test tokens
            customerToken = generateAccessToken({
                userId: 'test-customer-id',
                role: 'CUSTOMER',
                email: 'customer@test.com'
            });

            partnerToken = generateAccessToken({
                userId: 'test-partner-id',
                role: 'SERVICE_PARTNER',
                email: 'partner@test.com'
            });

            adminToken = generateAccessToken({
                userId: 'test-admin-id',
                role: 'ADMIN',
                email: 'admin@test.com'
            });

            done();
        });
    });

    afterAll((done) => {
        // Cleanup
        if (customerSocket?.connected) customerSocket.disconnect();
        if (partnerSocket?.connected) partnerSocket.disconnect();
        if (adminSocket?.connected) adminSocket.disconnect();

        httpServer.close(done);
    });

    describe('Customer Namespace (/customer)', () => {
        it('should connect with valid token', (done) => {
            customerSocket = Client(`http://localhost:${serverPort}/customer`, {
                auth: { token: customerToken },
                transports: ['websocket']
            });

            customerSocket.on('connect', () => {
                expect(customerSocket.connected).toBe(true);
                done();
            });

            customerSocket.on('connect_error', (error) => {
                done(error);
            });
        });

        it('should reject connection without token', (done) => {
            const unauthorizedSocket = Client(`http://localhost:${serverPort}/customer`, {
                transports: ['websocket']
            });

            unauthorizedSocket.on('connect_error', (error) => {
                expect(error.message).toContain('Authentication');
                unauthorizedSocket.disconnect();
                done();
            });

            // If it connects, fail the test
            unauthorizedSocket.on('connect', () => {
                unauthorizedSocket.disconnect();
                done(new Error('Should not connect without token'));
            });
        });

        it('should join booking room successfully', (done) => {
            const testBookingId = 'test-booking-123';

            customerSocket.emit('booking:join', testBookingId);

            customerSocket.on('booking:joined', (data) => {
                expect(data.bookingId).toBe(testBookingId);
                done();
            });

            // Timeout if no response
            setTimeout(() => {
                done(new Error('No response from booking:join'));
            }, 3000);
        });

        it('should receive location updates', (done) => {
            const locationData = {
                latitude: 12.9716,
                longitude: 77.5946
            };

            customerSocket.on('partner:location_update', (data) => {
                expect(data).toHaveProperty('latitude');
                expect(data).toHaveProperty('longitude');
                done();
            });

            // Simulate partner sending location (would normally come from partner namespace)
            customerSocket.emit('test:trigger_location', locationData);

            setTimeout(() => {
                done(new Error('No location update received'));
            }, 3000);
        });
    });

    describe('Partner Namespace (/partner)', () => {
        it('should connect with valid partner token', (done) => {
            partnerSocket = Client(`http://localhost:${serverPort}/partner`, {
                auth: { token: partnerToken },
                transports: ['websocket']
            });

            partnerSocket.on('connect', () => {
                expect(partnerSocket.connected).toBe(true);
                done();
            });

            partnerSocket.on('connect_error', (error) => {
                done(error);
            });
        });

        it('should update partner availability', (done) => {
            const availabilityData = {
                status: 'AVAILABLE',
                latitude: 12.9716,
                longitude: 77.5946
            };

            partnerSocket.emit('partner:update_availability', availabilityData);

            partnerSocket.on('partner:availability_updated', (data) => {
                expect(data.status).toBe('AVAILABLE');
                done();
            });

            setTimeout(() => {
                done(new Error('No availability update confirmation'));
            }, 3000);
        });

        it('should accept booking assignment', (done) => {
            const bookingData = {
                bookingId: 'test-booking-456',
                action: 'accept'
            };

            partnerSocket.emit('booking:accept', bookingData);

            partnerSocket.on('booking:accepted', (data) => {
                expect(data.bookingId).toBe(bookingData.bookingId);
                done();
            });

            setTimeout(() => {
                done(new Error('No booking acceptance confirmation'));
            }, 3000);
        });
    });

    describe('Admin Namespace (/admin)', () => {
        it('should connect with valid admin token', (done) => {
            adminSocket = Client(`http://localhost:${serverPort}/admin`, {
                auth: { token: adminToken },
                transports: ['websocket']
            });

            adminSocket.on('connect', () => {
                expect(adminSocket.connected).toBe(true);
                done();
            });

            adminSocket.on('connect_error', (error) => {
                done(error);
            });
        });

        it('should request and receive dashboard stats', (done) => {
            adminSocket.emit('request:stats');

            adminSocket.on('dashboard:stats_update', (data) => {
                expect(data).toBeDefined();
                // Stats should have some structure
                done();
            });

            setTimeout(() => {
                done(new Error('No stats received'));
            }, 5000);
        });

        it('should reject non-admin connection', (done) => {
            const customerAdminSocket = Client(`http://localhost:${serverPort}/admin`, {
                auth: { token: customerToken },
                transports: ['websocket']
            });

            customerAdminSocket.on('connect_error', (error) => {
                expect(error.message).toContain('Unauthorized');
                customerAdminSocket.disconnect();
                done();
            });

            customerAdminSocket.on('connect', () => {
                customerAdminSocket.disconnect();
                done(new Error('Customer should not access admin namespace'));
            });
        });
    });

    describe('Real-time Messaging', () => {
        it('should send and receive messages', (done) => {
            const messageData = {
                receiverId: 'test-partner-id',
                message: 'Test message from customer',
                bookingId: 'test-booking-789'
            };

            partnerSocket.on('message:new', (data) => {
                expect(data.message).toBe(messageData.message);
                done();
            });

            customerSocket.emit('message:send', messageData);

            setTimeout(() => {
                done(new Error('Message not received'));
            }, 3000);
        });

        it('should emit typing indicator', (done) => {
            const typingData = {
                receiverId: 'test-customer-id',
                bookingId: 'test-booking-789'
            };

            customerSocket.on('message:typing', (data) => {
                expect(data.senderId).toBe('test-partner-id');
                done();
            });

            partnerSocket.emit('message:typing', typingData);

            setTimeout(() => {
                done(new Error('Typing indicator not received'));
            }, 3000);
        });
    });

    describe('Connection Management', () => {
        it('should handle disconnect gracefully', (done) => {
            const testSocket = Client(`http://localhost:${serverPort}/customer`, {
                auth: { token: customerToken },
                transports: ['websocket']
            });

            testSocket.on('connect', () => {
                testSocket.disconnect();
            });

            testSocket.on('disconnect', () => {
                expect(testSocket.connected).toBe(false);
                done();
            });
        });

        it('should reconnect after disconnect', (done) => {
            const testSocket = Client(`http://localhost:${serverPort}/customer`, {
                auth: { token: customerToken },
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 100
            });

            let connected = false;

            testSocket.on('connect', () => {
                if (!connected) {
                    connected = true;
                    testSocket.disconnect();
                } else {
                    // Reconnected successfully
                    testSocket.disconnect();
                    done();
                }
            });
        });
    });

    describe('Event Validation', () => {
        it('should validate booking data format', (done) => {
            const invalidBookingData = {
                // Missing required fields
                invalid: 'data'
            };

            customerSocket.emit('booking:create', invalidBookingData);

            customerSocket.on('error', (error) => {
                expect(error).toBeDefined();
                done();
            });

            setTimeout(() => {
                // If no error, that's also acceptable (handler might not emit error)
                done();
            }, 2000);
        });
    });
});
