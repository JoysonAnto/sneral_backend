import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';

describe('Auth API Integration Tests', () => {
    let testUser = {
        email: `test${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Test User',
        phoneNumber: '+919876543210',
        role: 'CUSTOMER' as const,
    };

    let authToken: string;
    let refreshToken: string;

    afterAll(async () => {
        // Cleanup test data
        await prisma.user.deleteMany({
            where: { email: testUser.email },
        });
        await prisma.$disconnect();
    });

    describe('POST /api/v1/auth/register', () => {
        it('should register new user successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toHaveProperty('id');
            expect(response.body.data.user.email).toBe(testUser.email);
            expect(response.body.data.user.email_verified).toBe(false);
        });

        it('should not register duplicate email', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(testUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('already exists');
        });

        it('should validate email format', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({ ...testUser, email: 'invalid-email' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should validate password strength', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({ ...testUser, email: 'new@example.com', password: 'weak' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({ email: 'test@example.com' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeAll(async () => {
            // Verify email for login test
            await prisma.user.update({
                where: { email: testUser.email },
                data: { email_verified: true },
            });
        });

        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('access_token');
            expect(response.body.data).toHaveProperty('refresh_token');

            authToken = response.body.data.access_token;
            refreshToken = response.body.data.refresh_token;
        });

        it('should not login with wrong password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: testUser.email,
                    password: 'WrongPassword123!',
                })
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should not login non-existent user', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'Password123!',
                })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v1/auth/profile', () => {
        it('should get profile with valid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(testUser.email);
        });

        it('should not get profile without token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should not get profile with invalid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PATCH /api/v1/auth/profile', () => {
        it('should update profile successfully', async () => {
            const response = await request(app)
                .patch('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ fullName: 'Updated Name' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.full_name).toBe('Updated Name');
        });
    });

    describe('POST /api/v1/auth/refresh-token', () => {
        it('should refresh token successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh-token')
                .send({ refreshToken })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('access_token');
        });

        it('should not refresh with invalid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh-token')
                .send({ refreshToken: 'invalid-token' })
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        it('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});
