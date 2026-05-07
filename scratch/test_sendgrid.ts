import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { EmailService } from '../src/services/email.service';
import { logger } from '../src/utils/logger';

async function testSendGrid() {
  logger.info('--- Starting SendGrid Integration Test ---');
  
  const emailService = new EmailService();
  const testEmail = 'anbuliyon@gmail.com'; // Testing with one of the project emails
  const testName = 'Test User';
  const testOtp = '123456';

  logger.info(`Attempting to send test OTP email to: ${testEmail}`);

  try {
    await emailService.sendLoginOTPEmail(testEmail, testOtp, testName);
    logger.info('Test execution finished. Check the logs above for any SendGrid errors.');
  } catch (error) {
    logger.error('Unexpected error during test execution:', error);
  }
}

testSendGrid();
