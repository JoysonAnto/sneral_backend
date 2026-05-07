import axios from 'axios';
import { logger } from '../utils/logger';

export class EmailService {
  private apiKey: string;
  private apiUrl: string = 'https://api.elasticemail.com/v2/email/send';

  constructor() {
    this.apiKey = process.env.ELASTIC_EMAIL_API_KEY || '';
    if (this.apiKey) {
      logger.info('Elastic Email API initialized');
    } else {
      logger.warn('Elastic Email API Key missing. Email delivery will fail.');
    }
  }

  private getFromEmail() {
    return process.env.EMAIL_FROM || 'noreply@yourapp.com';
  }

  private async sendEmail(to: string, subject: string, bodyHtml: string) {
    try {
      const params = new URLSearchParams();
      params.append('apikey', this.apiKey);
      params.append('from', this.getFromEmail());
      params.append('to', to);
      params.append('subject', subject);
      params.append('bodyHtml', bodyHtml);
      params.append('isTransactional', 'true');

      const response = await axios.post(this.apiUrl, params);

      if (response.data.success === false) {
        logger.error('Elastic Email Error:', response.data.error);
      } else {
        logger.info(`Email sent to ${to} via Elastic Email. Transaction ID: ${response.data.data?.transactionid}`);
      }
    } catch (error) {
      logger.error('Error sending email via Elastic Email:', error);
    }
  }

  async sendVerificationEmail(email: string, otp: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome ${name}!</h2>
        <p>Thank you for registering. Please verify your email address by entering the OTP below:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${otp}
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `;
    await this.sendEmail(email, 'Verify Your Email - OTP', html);
  }

  async sendPasswordResetEmail(email: string, otp: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${name},</h2>
        <p>You requested to reset your password. Please use the OTP below to reset your password:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${otp}
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request a password reset, please ignore this email and ensure your account is secure.</p>
      </div>
    `;
    await this.sendEmail(email, 'Password Reset - OTP', html);
  }

  async sendLoginOTPEmail(email: string, otp: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${name},</h2>
        <p>Use the OTP below to complete your login:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${otp}
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't attempt to login, please ignore this email.</p>
      </div>
    `;
    await this.sendEmail(email, 'Login OTP - Snearal', html);
  }

  async sendStartOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${customerName},</h2>
        <p>Your technician is ready to start the service for booking <strong>#${bookingNumber}</strong>.</p>
        <p>Please share the following code with the technician to begin the job:</p>
        <div style="background-color: #e3f2fd; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #1976d2; border-radius: 8px;">
          ${otp}
        </div>
        <p>This code ensures that the service starts only when the technician is at your location.</p>
      </div>
    `;
    await this.sendEmail(email, `Start Code for Booking #${bookingNumber}`, html);
  }

  async sendCompletionOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${customerName},</h2>
        <p>Your service for booking <strong>#${bookingNumber}</strong> has been finished.</p>
        <p>If you are satisfied with the work, please share the following completion code with the technician:</p>
        <div style="background-color: #e8f5e9; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #2e7d32; border-radius: 8px;">
          ${otp}
        </div>
        <p>Sharing this code confirms that the job has been completed to your satisfaction.</p>
      </div>
    `;
    await this.sendEmail(email, `Completion Code for Booking #${bookingNumber}`, html);
  }

  async sendBookingConfirmation(email: string, bookingDetails: any) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking Confirmed!</h2>
        <p>Your booking has been confirmed. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Booking Number:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${bookingDetails.bookingNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Service:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${bookingDetails.serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Date:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${bookingDetails.date}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">₹${bookingDetails.amount}</td>
          </tr>
        </table>
        <p>Thank you for choosing our service!</p>
      </div>
    `;
    await this.sendEmail(email, `Booking Confirmation - ${bookingDetails.bookingNumber}`, html);
  }

  async sendInvoiceEmail(email: string, invoiceData: any) {
    // Note: Elastic Email v2 requires a separate API call to upload attachments.
    // For now, we send the notification, but standard transactional emails are the priority.
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
    await this.sendEmail(email, `Invoice ${invoice.invoice_number} from ${invoice.business_partner.business_name}`, html);
  }
}
