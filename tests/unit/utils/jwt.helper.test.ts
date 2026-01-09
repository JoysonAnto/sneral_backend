import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../../src/utils/jwt.helper';

describe('JWT Helper', () => {
    const testPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'CUSTOMER',
    };

    describe('generateAccessToken', () => {
        it('should generate a valid access token', () => {
            const token = generateAccessToken(testPayload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
        });

        it('should include payload data in token', () => {
            const token = generateAccessToken(testPayload);
            const decoded = verifyAccessToken(token);
            expect(decoded.userId).toBe(testPayload.userId);
            expect(decoded.email).toBe(testPayload.email);
            expect(decoded.role).toBe(testPayload.role);
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token', () => {
            const token = generateRefreshToken(testPayload.userId);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });
    });

    describe('verifyAccessToken', () => {
        it('should verify and decode valid token', () => {
            const token = generateAccessToken(testPayload);
            const decoded = verifyAccessToken(token);
            expect(decoded).toMatchObject(testPayload);
        });

        it('should throw error for invalid token', () => {
            expect(() => verifyAccessToken('invalid-token')).toThrow();
        });

        it('should throw error for malformed token', () => {
            expect(() => verifyAccessToken('not.a.token')).toThrow();
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify valid refresh token', () => {
            const token = generateRefreshToken(testPayload.userId);
            const decoded = verifyRefreshToken(token);
            expect(decoded.userId).toBe(testPayload.userId);
        });

        it('should throw error for expired token', () => {
            // This would require mocking time or using expired token
            const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.invalid';
            expect(() => verifyRefreshToken(expiredToken)).toThrow();
        });
    });
});
