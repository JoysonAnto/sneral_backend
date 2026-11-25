import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from '../utils/logger';

export interface EmailSendResult {
  success: boolean;
  provider?: 'smtp' | 'elastic_email' | 'simulated';
  id?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private apiKey: string;
  private apiUrl: string = 'https://api.elasticemail.com/v2/email/send';

  constructor() {
    this.apiKey = process.env.ELASTIC_EMAIL_API_KEY || '';

    // Initialize SMTP if host and user are configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (smtpHost && smtpUser) {
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;
      
      // Clean up whitespace from App Passwords if present (e.g., 'xxxx xxxx xxxx xxxx')
      const sanitizedPass = smtpPass ? smtpPass.replace(/\s+/g, '') : '';

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: isSecure,
        auth: {
          user: smtpUser,
          pass: sanitizedPass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });

      logger.info(`EmailService: SMTP initialized with host ${smtpHost}:${port} (${smtpUser})`);
    }

    if (this.apiKey) {
      logger.info('EmailService: Elastic Email API initialized');
    }

    if (!this.transporter && !this.apiKey) {
      logger.warn('EmailService: Neither SMTP nor Elastic Email configured. Email delivery will be simulated in logs.');
    }
  }

  private getFromEmail(): string {
    return process.env.EMAIL_FROM || '"Snearal" <noreply@snearal.com>';
  }

  /**
   * Send an email via SMTP with fallback to Elastic Email, or direct Elastic Email if SMTP is not configured.
   */
  public async sendEmail(to: string, subject: string, bodyHtml: string): Promise<EmailSendResult> {
    // 1. Try SMTP if configured
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.getFromEmail(),
          to,
          subject,
          html: bodyHtml,
        });

        logger.info(`Email successfully sent to ${to} via SMTP. Message ID: ${info.messageId}`);
        return { success: true, provider: 'smtp', id: info.messageId };
      } catch (smtpError: any) {
        logger.error(`SMTP delivery failed to ${to}: ${smtpError.message}`);
        // If Elastic Email is also available, attempt fallback
        if (this.apiKey) {
          logger.info(`Attempting fallback email dispatch via Elastic Email to ${to}...`);
          return await this.sendViaElasticEmail(to, subject, bodyHtml);
        }
        return { success: false, error: smtpError.message };
      }
    }

    // 2. Try Elastic Email if SMTP not configured
    if (this.apiKey) {
      return await this.sendViaElasticEmail(to, subject, bodyHtml);
    }

    // 3. Fallback simulation
    logger.warn(`Email simulation: No active email provider configured. Target: ${to}. Subject: ${subject}`);
    return { success: false, provider: 'simulated', error: 'No active email provider configured' };
  }

  /**
   * Internal helper to send via Elastic Email HTTP API v2
   */
  private async sendViaElasticEmail(to: string, subject: string, bodyHtml: string): Promise<EmailSendResult> {
    try {
      const params = new URLSearchParams();
      params.append('apikey', this.apiKey);
      params.append('from', this.getFromEmail());
      params.append('to', to);
      params.append('subject', subject);
      params.append('bodyHtml', bodyHtml);
      params.append('isTransactional', 'true');

      const response = await axios.post(this.apiUrl, params, {
        validateStatus: () => true,
      });

      if (response.data.success === false) {
        const errorMsg = typeof response.data.error === 'object'
          ? JSON.stringify(response.data.error)
          : String(response.data.error || 'Unknown Elastic Email error');

        if (errorMsg.includes('purchase one of our plan')) {
          logger.warn(`Email simulation: Elastic Email free plan limit reached. Target: ${to}. Subject: ${subject}`);
        } else {
          logger.error(`Elastic Email Error: ${errorMsg}`);
        }
        return { success: false, error: errorMsg };
      } else if (response.status >= 400) {
        const statusMsg = `Elastic Email HTTP Error ${response.status}: ${JSON.stringify(response.data)}`;
        logger.error(statusMsg);
        return { success: false, error: statusMsg };
      } else {
        const transactionId = response.data.data?.transactionid || 'unknown';
        logger.info(`Email sent to ${to} via Elastic Email. Transaction ID: ${transactionId}`);
        return { success: true, provider: 'elastic_email', id: transactionId };
      }
    } catch (error: any) {
      const errorMsg = `Unexpected error sending email via Elastic Email: ${error.message}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Verify connections to configured email services
   */
  public async verifyConnection(): Promise<{
    smtp: { configured: boolean; ok: boolean; message?: string };
    elasticEmail: { configured: boolean; ok: boolean; message?: string };
  }> {
    const result = {
      smtp: { configured: Boolean(this.transporter), ok: false, message: undefined as string | undefined },
      elasticEmail: { configured: Boolean(this.apiKey), ok: false, message: undefined as string | undefined },
    };

    if (this.transporter) {
      try {
        await this.transporter.verify();
        result.smtp.ok = true;
        result.smtp.message = 'SMTP transporter verified successfully';
      } catch (err: any) {
        result.smtp.ok = false;
        result.smtp.message = err.message;
      }
    }

    if (this.apiKey) {
      try {
        // Probe Elastic Email account status endpoint
        const probeRes = await axios.get(`https://api.elasticemail.com/v2/account/load?apikey=${encodeURIComponent(this.apiKey)}`, {
          validateStatus: () => true,
        });
        if (probeRes.data.success) {
          result.elasticEmail.ok = true;
          result.elasticEmail.message = 'Elastic Email API key is active and valid';
        } else {
          result.elasticEmail.ok = false;
          result.elasticEmail.message = typeof probeRes.data.error === 'object'
            ? JSON.stringify(probeRes.data.error)
            : String(probeRes.data.error || 'Invalid API key');
        }
      } catch (err: any) {
        result.elasticEmail.ok = false;
        result.elasticEmail.message = err.message;
      }
    }

    return result;
  }

  async sendVerificationEmail(email: string, otp: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #2563eb; color: #ffffff; padding: 16px; border-radius: 6px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Snearal</h1>
        </div>
        <div style="padding: 24px 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Welcome, ${name}!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.5;">Thank you for registering. Please verify your email address by entering the 6-digit OTP below:</p>
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1e293b; border-radius: 6px; margin: 24px 0;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 14px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you didn't create an account, please ignore this email.</p>
        </div>
      </div>
    `;
    return await this.sendEmail(email, 'Verify Your Email - OTP', html);
  }

  async sendPasswordResetEmail(email: string, otp: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #2563eb; color: #ffffff; padding: 16px; border-radius: 6px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Snearal</h1>
        </div>
        <div style="padding: 24px 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.5;">You requested to reset your password. Please use the OTP below to reset your password:</p>
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #dc2626; border-radius: 6px; margin: 24px 0;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 14px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you didn't request a password reset, please ignore this email and ensure your account is secure.</p>
        </div>
      </div>
    `;
    return await this.sendEmail(email, 'Password Reset - OTP', html);
  }

  async sendLoginOTPEmail(email: string, otp: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #2563eb; color: #ffffff; padding: 16px; border-radius: 6px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Snearal</h1>
        </div>
        <div style="padding: 24px 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.5;">Use the one-time passcode below to complete your login:</p>
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #2563eb; border-radius: 6px; margin: 24px 0;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 14px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you didn't attempt to login, please ignore this email.</p>
        </div>
      </div>
    `;
    return await this.sendEmail(email, 'Login OTP - Snearal', html);
  }

  async sendStartOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b;">Hello ${customerName},</h2>
        <p style="color: #475569; font-size: 15px;">Your technician is ready to start the service for booking <strong>#${bookingNumber}</strong>.</p>
        <p style="color: #475569; font-size: 15px;">Please share the following code with the technician to begin the job:</p>
        <div style="background-color: #e3f2fd; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #1976d2; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 13px;">This code ensures that the service starts only when the technician is at your location.</p>
      </div>
    `;
    return await this.sendEmail(email, `Start Code for Booking #${bookingNumber}`, html);
  }

  async sendCompletionOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b;">Hello ${customerName},</h2>
        <p style="color: #475569; font-size: 15px;">Your service for booking <strong>#${bookingNumber}</strong> has been finished.</p>
        <p style="color: #475569; font-size: 15px;">If you are satisfied with the work, please share the following completion code with the technician:</p>
        <div style="background-color: #e8f5e9; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #2e7d32; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 13px;">Sharing this code confirms that the job has been completed to your satisfaction.</p>
      </div>
    `;
    return await this.sendEmail(email, `Completion Code for Booking #${bookingNumber}`, html);
  }

  async sendPauseOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string, reason?: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #310D59;">Snearal Service Pause Code</h2>
        <p style="color: #475569; font-size: 15px;">Hello ${customerName},</p>
        <p style="color: #475569; font-size: 15px;">Your service partner has requested to pause / hold today's work on booking <strong>#${bookingNumber}</strong>.</p>
        ${reason ? `<p style="color: #475569; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>` : ''}
        <div style="background-color: #f3e8ff; border: 2px dashed #310D59; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #310D59;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">Share this code with your partner only when you agree to put today's work on hold and resume later.</p>
      </div>
    `;
    return await this.sendEmail(email, `Pause Verification Code for Booking #${bookingNumber}`, html);
  }

  async sendResumeOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2FA084;">Snearal Service Resumption Code</h2>
        <p style="color: #475569; font-size: 15px;">Hello ${customerName},</p>
        <p style="color: #475569; font-size: 15px;">Your service partner is ready to resume work on booking <strong>#${bookingNumber}</strong>.</p>
        <div style="background-color: #ecfdf5; border: 2px dashed #2FA084; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2FA084;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">Share this code with your partner to confirm that work is resuming.</p>
      </div>
    `;
    return await this.sendEmail(email, `Resumption Code for Booking #${bookingNumber}`, html);
  }

  async sendBookingConfirmation(email: string, bookingDetails: any) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b;">Booking Confirmed!</h2>
        <p style="color: #475569;">Your booking has been confirmed. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #64748b;"><strong>Booking Number:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">${bookingDetails.bookingNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #64748b;"><strong>Service:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">${bookingDetails.serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #64748b;"><strong>Date:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">${bookingDetails.date}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #64748b;"><strong>Amount:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">₹${bookingDetails.amount}</td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 14px;">Thank you for choosing Snearal!</p>
      </div>
    `;
    return await this.sendEmail(email, `Booking Confirmation - ${bookingDetails.bookingNumber}`, html);
  }

  async sendInvoiceEmail(email: string, invoiceData: any) {
    const invoice = invoiceData;
    const customer = invoice.customer;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${invoice.business_partner.business_name}</h1>
          <p style="color: #e9d5ff; margin: 10px 0 0 0;">Invoice</p>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${customer.name},</h2>
          <p style="color: #666; line-height: 1.6;">
            Your invoice <strong>${invoice.invoice_number}</strong> is ready.
          </p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Total Amount: ₹${invoice.total_amount.toLocaleString('en-IN')}</p>
          </div>
          <p>Thank you for your business!</p>
        </div>
      </div>
    `;
    return await this.sendEmail(email, `Invoice ${invoice.invoice_number} from ${invoice.business_partner.business_name}`, html);
  }
}
