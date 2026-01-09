import { hashPassword, comparePassword, generateOTP } from '../../../src/utils/encryption';

describe('Encryption Utils', () => {
    describe('hashPassword', () => {
        it('should hash password successfully', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
        });

        it('should generate different hashes for same password', async () => {
            const password = 'TestPassword123!';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            expect(hash1).not.toBe(hash2); // Due to salt
        });
    });

    describe('comparePassword', () => {
        it('should return true for matching passwords', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);
            const isMatch = await comparePassword(password, hash);

            expect(isMatch).toBe(true);
        });

        it('should return false for non-matching passwords', async () => {
            const password = 'TestPassword123!';
            const wrongPassword = 'WrongPassword456!';
            const hash = await hashPassword(password);
            const isMatch = await comparePassword(wrongPassword, hash);

            expect(isMatch).toBe(false);
        });

        it('should handle empty password', async () => {
            const hash = await hashPassword('password');
            const isMatch = await comparePassword('', hash);

            expect(isMatch).toBe(false);
        });
    });

    describe('generateOTP', () => {
        it('should generate 6-digit OTP', () => {
            const otp = generateOTP();

            expect(otp).toBeDefined();
            expect(otp.length).toBe(6);
            expect(/^\d{6}$/.test(otp)).toBe(true);
        });

        it('should generate different OTPs', () => {
            const otp1 = generateOTP();
            const otp2 = generateOTP();

            // Very low probability of collision
            expect(otp1).not.toBe(otp2);
        });

        it('should only contain numbers', () => {
            const otp = generateOTP();
            const isNumeric = /^[0-9]+$/.test(otp);

            expect(isNumeric).toBe(true);
        });
    });
});
