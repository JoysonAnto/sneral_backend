import dotenv from 'dotenv';
dotenv.config();

import prisma from './src/config/database';
import { AuthService } from './src/services/auth.service';

async function runMobileOtpAndSessionTest() {
  console.log('\n=============================================================');
  console.log('    TEST: MOBILE NUMBER OTP LOGIN & SESSION REFRESH FLOW     ');
  console.log('=============================================================\n');

  const authService = new AuthService();
  const testPhoneDigits = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPhoneRaw = `+91 ${testPhoneDigits.slice(0, 5)} ${testPhoneDigits.slice(5)}`; // Test raw spacing and +91

  console.log(`📱 Step 1: Requesting Login OTP for mobile number: "${testPhoneRaw}"...`);
  const loginRes = await authService.login(testPhoneRaw);
  console.log('Login Response:', {
    message: loginRes.message,
    otp: loginRes.otp,
    otpLength: loginRes.otp?.length
  });

  if (!loginRes.otp || loginRes.otp.length !== 6) {
    throw new Error(`FAILURE: Expected 6-digit OTP, but got ${loginRes.otp}`);
  }
  console.log('✅ PASS: 6-digit OTP generated successfully:', loginRes.otp);

  console.log('\n🔐 Step 2: Verifying Mobile OTP...');
  // Test verifying with unformatted 10-digit number to ensure cross-format normalization
  const verifyRes = await authService.verifyOtp(testPhoneDigits, loginRes.otp);
  console.log('Verification Response:', {
    message: verifyRes.message,
    userPhone: verifyRes.user?.phoneNumber,
    userRole: verifyRes.user?.role,
    accessTokenPresent: Boolean(verifyRes.accessToken),
    refreshTokenPresent: Boolean(verifyRes.refreshToken),
  });

  if (!verifyRes.accessToken || !verifyRes.refreshToken) {
    throw new Error('FAILURE: Access token or refresh token missing in verification response');
  }
  console.log('✅ PASS: Access Token & Refresh Token issued successfully!');

  console.log('\n🔄 Step 3: Testing Refresh Token Rotation (/auth/refresh-token)...');
  const refreshRes = await authService.refreshToken(verifyRes.refreshToken);
  console.log('Refresh Token Response:', {
    newAccessTokenPresent: Boolean(refreshRes.accessToken),
    newRefreshTokenPresent: Boolean(refreshRes.refreshToken),
  });

  if (!refreshRes.accessToken) {
    throw new Error('FAILURE: Failed to issue fresh access token using refresh token');
  }
  console.log('✅ PASS: Silent token refresh succeeded seamlessly!');

  console.log('\n🧹 Step 4: Cleaning up test account from database...');
  await prisma.user.delete({ where: { id: verifyRes.user.id } });
  console.log('✅ PASS: Test account cleaned up cleanly.');

  console.log('\n=============================================================');
  console.log('🎉 ALL MOBILE OTP LOGIN & SESSION REFRESH TESTS PASSED!');
  console.log('=============================================================\n');
  process.exit(0);
}

runMobileOtpAndSessionTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
