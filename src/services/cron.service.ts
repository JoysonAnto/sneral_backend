import cron, { ScheduledTask } from 'node-cron';
import { recurringInvoiceService } from './recurring-invoice.service';
import { offlineInvoiceService } from './offline-invoice.service';
import { BookingService } from './booking.service';
import { logger } from '../utils/logger';
import prisma from '../config/database';

export class CronService {
    private jobs: ScheduledTask[] = [];

    start() {
        logger.info('Starting cron service...');

        // Run daily at midnight to generate due recurring invoices
        const recurringInvoiceJob = cron.schedule('0 0 * * *', async () => {
            logger.info('Running recurring invoice generation job...');
            try {
                const result = await recurringInvoiceService.generateDueInvoices();
                logger.info(`Generated ${result.total_processed} invoices from recurring templates`);
            } catch (error) {
                logger.error('Error generating recurring invoices:', error);
            }
        }, {
            timezone: 'Asia/Kolkata', // Adjust timezone as needed
        });

        this.jobs.push(recurringInvoiceJob);

        // Optional: Run hourly to mark overdue invoices
        const overdueInvoiceJob = cron.schedule('0 * * * *', async () => {
            logger.info('Running overdue invoice check...');
            try {
                await offlineInvoiceService.markOverdueInvoices();
                logger.info('Overdue invoice check completed');
            } catch (error) {
                logger.error('Error marking overdue invoices:', error);
            }
        });

        this.jobs.push(overdueInvoiceJob);

        // Run every hour to cleanup abandoned bookings
        const abandonedBookingJob = cron.schedule('0 * * * *', async () => {
            logger.info('Running abandoned booking cleanup...');
            try {
                const oneHourAgo = new Date();
                oneHourAgo.setHours(oneHourAgo.getHours() - 1);

                // Find PENDING bookings older than 1 hour with no payment
                const abandonedBookings = await prisma.booking.findMany({
                    where: {
                        status: 'PENDING',
                        payment_status: 'PENDING',
                        created_at: { lt: oneHourAgo },
                    },
                });

                if (abandonedBookings.length > 0) {
                    const bookingService = new BookingService();
                    for (const booking of abandonedBookings) {
                        try {
                            await bookingService.updateBookingStatus(
                                booking.id,
                                'CANCELLED',
                                'SYSTEM',
                                'Automatically cancelled due to inactivity/missing payment.'
                            );
                            logger.info(`Cancelled abandoned booking: ${booking.id}`);
                        } catch (err) {
                            logger.error(`Failed to cancel booking ${booking.id}:`, err);
                        }
                    }
                }
            } catch (error) {
                logger.error('Error in Abandoned Booking Cleanup:', error);
            }
        });

        this.jobs.push(abandonedBookingJob);

        logger.info('Cron service started with ' + this.jobs.length + ' jobs');
    }

    stop() {
        logger.info('Stopping cron service...');
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        logger.info('Cron service stopped');
    }

    // Method to manually trigger recurring invoice generation (useful for testing)
    async runRecurringInvoiceGeneration() {
        logger.info('Manually triggering recurring invoice generation...');
        try {
            const result = await recurringInvoiceService.generateDueInvoices();
            logger.info(`Generated ${result.total_processed} invoices`);
            return result;
        } catch (error) {
            logger.error('Error in manual invoice generation:', error);
            throw error;
        }
    }
}

export const cronService = new CronService();
