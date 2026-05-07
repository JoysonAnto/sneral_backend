import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { EmailService } from '../src/services/email.service';
import { logger } from '../src/utils/logger';

async function testElasticEmail() {
  logger.info('--- Starting Elastic Email Integration Test ---');
  
  const emailService = new EmailService();
  const testEmail = 'snearaldev@gmail.com'; // Using the registered email for test
  const testName = 'Snearal Dev';
  const testOtp = '987654';

  logger.info(`Attempting to send test OTP email to: ${testEmail}`);

  try {
    await emailService.sendLoginOTPEmail(testEmail, testOtp, testName);
    logger.info('Test execution finished. Check the logs above for any Elastic Email errors.');
  } catch (error) {
    logger.error('Unexpected error during test execution:', error);
  }
}

testElasticEmail();
