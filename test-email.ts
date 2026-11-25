import dotenv from 'dotenv';
dotenv.config();

import { EmailService } from './src/services/email.service';

async function runEmailTest() {
  console.log('\n=============================================================');
  console.log('       SNEARAL BACKEND - TRANSACTIONAL EMAIL VERIFIER        ');
  console.log('=============================================================\n');

  // Determine recipient
  const rawArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const namedArg = process.argv.find((arg) => arg.startsWith('--to='))?.split('=')[1];
  const targetEmail = namedArg || rawArg || process.env.SMTP_USER || 'jasonantho53@gmail.com';

  console.log(`Target Email Address : ${targetEmail}`);
  console.log(`SMTP Configured      : ${process.env.SMTP_HOST ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}` : 'No'}`);
  console.log(`SMTP Account         : ${process.env.SMTP_USER || 'None'}`);
  console.log(`Elastic Email Key    : ${process.env.ELASTIC_EMAIL_API_KEY ? 'Present (ending in ' + process.env.ELASTIC_EMAIL_API_KEY.slice(-6) + ')' : 'None'}`);
  console.log(`Sender Header        : ${process.env.EMAIL_FROM || '"Snearal" <noreply@snearal.com>'}\n`);

  const emailService = new EmailService();

  console.log('--- Step 1: Testing Provider Connections ---');
  const connections = await emailService.verifyConnection();

  if (connections.smtp.configured) {
    if (connections.smtp.ok) {
      console.log(`✅ SMTP Connection: PASSED (${connections.smtp.message})`);
    } else {
      console.log(`❌ SMTP Connection: FAILED (${connections.smtp.message})`);
    }
  } else {
    console.log('ℹ️  SMTP: Not configured');
  }

  if (connections.elasticEmail.configured) {
    if (connections.elasticEmail.ok) {
      console.log(`✅ Elastic Email API: PASSED (${connections.elasticEmail.message})`);
    } else {
      console.log(`❌ Elastic Email API: FAILED (${connections.elasticEmail.message})`);
    }
  } else {
    console.log('ℹ️  Elastic Email: Not configured');
  }

  console.log('\n--- Step 2: Dispatching Live Verification Email ---');
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const startTime = Date.now();

  const sendResult = await emailService.sendVerificationEmail(targetEmail, testOtp, 'Snearal Tester');
  const duration = Date.now() - startTime;

  if (sendResult.success) {
    console.log('\n🎉 SUCCESS: Verification email sent and delivered!');
    console.log(`   Provider Used : ${sendResult.provider?.toUpperCase()}`);
    console.log(`   Message/Tx ID : ${sendResult.id}`);
    console.log(`   Generated OTP : ${testOtp}`);
    console.log(`   Duration      : ${duration}ms`);
    console.log(`\n📬 Please check the inbox (and spam/promotions folder) of '${targetEmail}'.`);
    console.log('=============================================================\n');
    process.exit(0);
  } else {
    console.error('\n❌ FAILURE: Could not deliver email.');
    console.error(`   Error details : ${sendResult.error}`);
    console.error(`   Duration      : ${duration}ms`);
    console.error('=============================================================\n');
    process.exit(1);
  }
}

runEmailTest().catch((err) => {
  console.error('Fatal unhandled error running email test:', err);
  process.exit(1);
});
