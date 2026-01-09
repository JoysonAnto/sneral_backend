import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendVerificationEmail(email: string, otp: string, name: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
        to: email,
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
      logger.info(`Verification email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending verification email:', error);
      // Don't throw error to prevent registration from failing
    }
  }

  async sendPasswordResetEmail(email: string, otp: string, name: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
        to: email,
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
      logger.info(`Password reset email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending password reset email:', error);
    }
  }

  async sendBookingConfirmation(email: string, bookingDetails: any) {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
        to: email,
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
      logger.info(`Booking confirmation email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending booking confirmation email:', error);
    }
  }

  async sendInvoiceEmail(email: string, invoiceData: any, pdfBuffer: Buffer) {
    try {
      const invoice = invoiceData;
      const customer = invoice.customer;

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
        to: email,
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
                  ${invoice.balance_amount > 0 ? `
                  <tr>
                    <td style="padding: 8px 0; color: #ef4444; font-size: 14px; font-weight: bold;">Balance Due:</td>
                    <td style="padding: 8px 0; color: #ef4444; font-weight: bold; text-align: right;">₹${invoice.balance_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              ${invoice.payment_instructions ? `
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <h3 style="color: #d97706; margin: 0 0 10px 0; font-size: 14px;">Payment Instructions</h3>
                  <p style="color: #92400e; margin: 0; font-size: 13px;">${invoice.payment_instructions}</p>
                </div>
              ` : ''}
              
              <p style="color: #666; line-height: 1.6; margin-top: 20px;">
                If you have any questions regarding this invoice, please contact us at 
                <a href="mailto:${invoice.business_partner.user.email}" style="color: #8b5cf6; text-decoration: none;">${invoice.business_partner.user.email}</a> 
                or call ${invoice.business_partner.user.phone_number}.
              </p>
              
              <p style="color: #666; margin-top: 20px;">
                Thank you for your business!
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">${invoice.business_partner.business_name}</p>
              <p style="margin: 5px 0;">${invoice.business_partner.user.email} | ${invoice.business_partner.user.phone_number}</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `invoice-${invoice.invoice_number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      logger.info(`Invoice email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending invoice email:', error);
      throw error;
    }
  }
}
