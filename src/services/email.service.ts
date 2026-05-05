import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

export class EmailService {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      logger.info('SendGrid API initialized');
    } else {
      logger.warn('SendGrid API Key missing. Email delivery will fail.');
    }
  }

  private getFromEmail() {
    return process.env.EMAIL_FROM || 'noreply@yourapp.com';
  }

  async sendVerificationEmail(email: string, otp: string, name: string) {
    try {
      await sgMail.send({
        to: email,
        from: this.getFromEmail(),
        subject: 'Verify Your Email - OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome ${name}!</h2>
            <p>Thank you for registering. Please verify your email address by entering the OTP below:</p>
            <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
              ${otp}
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
        `,
      });
      logger.info(`Verification email sent to ${email} via SendGrid`);
    } catch (error: any) {
      logger.error('Error sending verification email via SendGrid:', error.response?.body || error);
    }
  }

  async sendPasswordResetEmail(email: string, otp: string, name: string) {
    try {
      await sgMail.send({
        to: email,
        from: this.getFromEmail(),
        subject: 'Password Reset - OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>You requested to reset your password. Please use the OTP below to reset your password:</p>
            <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
              ${otp}
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request a password reset, please ignore this email and ensure your account is secure.</p>
          </div>
        `,
      });
      logger.info(`Password reset email sent to ${email} via SendGrid`);
    } catch (error: any) {
      logger.error('Error sending password reset email via SendGrid:', error.response?.body || error);
    }
  }

  async sendLoginOTPEmail(email: string, otp: string, name: string) {
    try {
      await sgMail.send({
        to: email,
        from: this.getFromEmail(),
        subject: 'Login OTP - Snearal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>Use the OTP below to complete your login:</p>
            <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
              ${otp}
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't attempt to login, please ignore this email.</p>
          </div>
        `,
      });
      logger.info(`Login OTP email sent to ${email} via SendGrid`);
    } catch (error: any) {
      logger.error('Error sending login OTP email via SendGrid:', error.response?.body || error);
    }
  }

  async sendStartOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string) {
    try {
      await sgMail.send({
        to: email,
        from: this.getFromEmail(),
        subject: `Start Code for Booking #${bookingNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${customerName},</h2>
            <p>Your technician is ready to start the service for booking <strong>#${bookingNumber}</strong>.</p>
            <p>Please share the following code with the technician to begin the job:</p>
            <div style="background-color: #e3f2fd; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #1976d2; border-radius: 8px;">
              ${otp}
            </div>
            <p>This code ensures that the service starts only when the technician is at your location.</p>
          </div>
        `,
      });
      logger.info(`Start OTP email sent to ${email} for booking ${bookingNumber} via SendGrid`);
    } catch (error: any) {
      logger.error('Error sending start OTP email via SendGrid:', error.response?.body || error);
    }
  }

  async sendCompletionOTPEmail(email: string, otp: string, bookingNumber: string, customerName: string) {
    try {
      await sgMail.send({
        to: email,
        from: this.getFromEmail(),
        subject: `Completion Code for Booking #${bookingNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${customerName},</h2>
            <p>Your service for booking <strong>#${bookingNumber}</strong> has been finished.</p>
            <p>If you are satisfied with the work, please share the following completion code with the technician:</p>
            <div style="background-color: #e8f5e9; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #2e7d32; border-radius: 8px;">
              ${otp}
            </div>
            <p>Sharing this code confirms that the job has been completed to your satisfaction.</p>
          </div>
        `,
      });
      logger.info(`Completion OTP email sent to ${email} for booking ${bookingNumber} via SendGrid`);
    } catch (error: any) {
      logger.error('Error sending completion OTP email via SendGrid:', error.response?.body || error);
    }
  }

  async sendBookingConfirmation(email: string, bookingDetails: any) {
    try {
      await sgMail.send({
        to: email,
        from: this.getFromEmail(),
        subject: `Booking Confirmation - ${bookingDetails.bookingNumber}`,
        html: `
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
        `,
      });
      logger.info(`Booking confirmation email sent to ${email} via SendGrid`);
    } catch (error: any) {
      logger.error('Error sending booking confirmation email via SendGrid:', error.response?.body || error);
    }
  }

  async sendInvoiceEmail(email: string, invoiceData: any, pdfBuffer: Buffer) {
    try {
      const invoice = invoiceData;
      const customer = invoice.customer;

      await sgMail.send({
        to: email,
        from: this.getFromEmail(),
        subject: `Invoice ${invoice.invoice_number} from ${invoice.business_partner.business_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${invoice.business_partner.business_name}</h1>
              <p style="color: #e9d5ff; margin: 10px 0 0 0;">Invoice</p>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Hi ${customer.name},</h2>
              <p style="color: #666; line-height: 1.6;">
                Please find attached invoice <strong>${invoice.invoice_number}</strong> for your review.
              </p>
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice Number:</td>
                    <td style="padding: 8px 0; color: #111827; font-weight: bold; text-align: right;">${invoice.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice Date:</td>
                    <td style="padding: 8px 0; color: #111827; text-align: right;">${new Date(invoice.invoice_date).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Due Date:</td>
                    <td style="padding: 8px 0; color: #111827; font-weight: bold; text-align: right;">${new Date(invoice.due_date).toLocaleDateString()}</td>
                  </tr>
                  <tr style="border-top: 2px solid #8b5cf6;">
                    <td style="padding: 15px 0 8px; color: #8b5cf6; font-size: 16px; font-weight: bold;">Total Amount:</td>
                    <td style="padding: 15px 0 8px; color: #8b5cf6; font-size: 18px; font-weight: bold; text-align: right;">₹${invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </table>
              </div>
              <p style="color: #666; margin-top: 20px;">Thank you for your business!</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `invoice-${invoice.invoice_number}.pdf`,
            content: pdfBuffer.toString('base64'),
            type: 'application/pdf',
            disposition: 'attachment',
          },
        ],
      });
      logger.info(`Invoice email sent to ${email} via SendGrid`);
    } catch (error: any) {
      logger.error('Error sending invoice email via SendGrid:', error.response?.body || error);
      throw error;
    }
  }
}
