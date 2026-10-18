import cron, { ScheduledTask } from 'node-cron';
import { recurringInvoiceService } from './recurring-invoice.service';
import { offlineInvoiceService } from './offline-invoice.service';
import { BookingService } from './booking.service';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import { WalletService } from './wallet.service';

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

        // Run every minute to retry partner search for PARTNER_NOT_FOUND
        const retryPartnerSearchJob = cron.schedule('* * * * *', async () => {
            try {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                
                const retryBookings = await prisma.booking.findMany({
                    where: {
                        status: 'PARTNER_NOT_FOUND',
                        updated_at: { lt: fiveMinutesAgo },
                    },
                });

                if (retryBookings.length > 0) {
                    const bookingService = new BookingService();
                    for (const booking of retryBookings) {
                        try {
                            if (booking.retry_count >= 3) {
                                await bookingService.updateBookingStatus(
                                    booking.id,
                                    'CANCELLED',
                                    'SYSTEM',
                                    'Automatically cancelled after 3 failed attempts to find a partner.'
                                );
                                logger.info(`Cancelled booking ${booking.id} after max retries.`);
                            } else {
                                // Increment retry count and set status to SEARCHING_PARTNER
                                await prisma.booking.update({
                                    where: { id: booking.id },
                                    data: {
                                        status: 'SEARCHING_PARTNER',
                                        retry_count: { increment: 1 },
                                        status_history: {
                                            create: {
                                                status: 'SEARCHING_PARTNER',
                                                changed_by: 'SYSTEM',
                                                notes: `Retrying partner search. Attempt ${booking.retry_count + 1}/3`,
                                            }
                                        }
                                    }
                                });
                                // Trigger partner search logic
                                await bookingService.findAndNotifyPartners(booking.id);
                                logger.info(`Retrying partner search for booking ${booking.id}. Attempt ${booking.retry_count + 1}`);
                            }
                        } catch (err) {
                            logger.error(`Failed to process retry for booking ${booking.id}:`, err);
                        }
                    }
                }
            } catch (error) {
                logger.error('Error in Partner Search Retry:', error);
            }
        });
        this.jobs.push(retryPartnerSearchJob);

        // Run every 10 seconds to check for bookings in SEARCHING_PARTNER for > 1 min
        const searchingPartnerNotificationJob = cron.schedule('*/10 * * * * *', async () => {
            try {
                const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

                // Find bookings that have been in SEARCHING_PARTNER for >= 1 minute and haven't broadcasted to admins/all partners yet
                const searchingBookings = await prisma.booking.findMany({
                    where: {
                        status: 'SEARCHING_PARTNER',
                        updated_at: { lte: oneMinuteAgo },
                        activity_logs: {
                            none: {
                                action: 'SEARCHING_PARTNER_BROADCAST_1MIN',
                            },
                        },
                    },
                    include: {
                        items: {
                            include: {
                                service: {
                                    include: {
                                        category: true,
                                    },
                                },
                            },
                        },
                        customer: {
                            select: {
                                full_name: true,
                            },
                        },
                    },
                });

                if (searchingBookings.length > 0) {
                    const { NotificationService } = await import('./notification.service');
                    const { getIO } = await import('../socket/socket.server');
                    const notificationService = new NotificationService();
                    const io = getIO();

                    // Fetch admin users
                    const adminUsers = await prisma.user.findMany({
                        where: {
                            role: { in: ['ADMIN', 'SUPER_ADMIN'] },
                            is_active: true,
                        },
                        select: { id: true, email: true },
                    });

                    // Fetch all available service partners
                    const availablePartners = await prisma.servicePartner.findMany({
                        where: {
                            availability_status: 'AVAILABLE',
                            kyc_status: 'APPROVED',
                        },
                        include: {
                            user: {
                                select: { id: true, full_name: true },
                            },
                        },
                    });

                    for (const booking of searchingBookings) {
                        try {
                            const serviceItem = booking.items[0];
                            const serviceName = serviceItem?.service?.name || 'Service';
                            const categoryName = serviceItem?.service?.category?.name || 'General';

                            // 1. Record activity log to ensure we don't notify repeatedly
                            await prisma.bookingActivityLog.create({
                                data: {
                                    booking_id: booking.id,
                                    actor_type: 'SYSTEM',
                                    actor_id: 'SYSTEM',
                                    action: 'SEARCHING_PARTNER_BROADCAST_1MIN',
                                    details: {
                                        notified_admins_count: adminUsers.length,
                                        notified_partners_count: availablePartners.length,
                                        timestamp: new Date().toISOString(),
                                    },
                                },
                            });

                            // 2. Notify Admins (Database persistent + real-time Socket)
                            for (const admin of adminUsers) {
                                await notificationService.createNotification(
                                    admin.id,
                                    'GENERAL',
                                    'Booking Still Searching Partner',
                                    `Booking #${booking.booking_number} (${serviceName}) has been searching for a partner for over 1 minute.`,
                                    { bookingId: booking.id, bookingNumber: booking.booking_number }
                                ).catch(err => logger.error(`Failed to notify admin ${admin.id}:`, err));
                            }

                            // Admin socket broadcast
                            try {
                                io.of('/admin').emit('booking:searching_delayed', {
                                    bookingId: booking.id,
                                    bookingNumber: booking.booking_number,
                                    service: serviceName,
                                    customer: booking.customer?.full_name,
                                    totalAmount: booking.total_amount,
                                    address: booking.service_address,
                                    message: `Booking #${booking.booking_number} has been searching for a partner for over 1 minute.`,
                                });
                            } catch (sockErr) {
                                logger.warn(`Error broadcasting to /admin socket: ${sockErr}`);
                            }

                            // 3. Notify All Available Partners (Database persistent + real-time Socket)
                            for (const partner of availablePartners) {
                                // Emit real-time job alert / notification to partner
                                try {
                                    const jobPayload = {
                                        id: booking.id,
                                        bookingNumber: booking.booking_number,
                                        service: {
                                            name: serviceName,
                                            category: categoryName,
                                        },
                                        customer: {
                                            name: booking.customer?.full_name || 'Customer',
                                        },
                                        location: booking.service_address,
                                        amount: booking.total_amount,
                                        scheduledDate: booking.scheduled_date,
                                        scheduledTime: booking.scheduled_time,
                                    };

                                    io.of('/partner').to(partner.user_id).emit('new_job', jobPayload);
                                    io.of('/partner').to(partner.user_id).emit('booking:new', jobPayload);
                                } catch (pSockErr) {
                                    logger.warn(`Error sending socket alert to partner ${partner.id}: ${pSockErr}`);
                                }

                                await notificationService.createNotification(
                                    partner.user_id,
                                    'NEW_BOOKING',
                                    'Urgent: Job Available',
                                    `New booking #${booking.booking_number} for ${serviceName} is waiting for an available partner!`,
                                    { bookingId: booking.id, bookingNumber: booking.booking_number }
                                ).catch(err => logger.error(`Failed to create notification for partner ${partner.id}:`, err));
                            }

                            logger.info(`Notified ${adminUsers.length} admins and ${availablePartners.length} available partners for booking ${booking.booking_number} (searching > 1 min).`);
                        } catch (bErr) {
                            logger.error(`Error processing delayed searching notification for booking ${booking.id}:`, bErr);
                        }
                    }
                }
            } catch (error) {
                logger.error('Error in Searching Partner Notification Job:', error);
            }
        });
        this.jobs.push(searchingPartnerNotificationJob);

        // Run every hour to auto-complete long running bookings (in progress > 48h)
        const autoCompleteJob = cron.schedule('0 * * * *', async () => {
            try {
                const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
                
                const longRunningBookings = await prisma.booking.findMany({
                    where: {
                        status: 'IN_PROGRESS',
                        updated_at: { lt: fortyEightHoursAgo },
                    },
                });

                if (longRunningBookings.length > 0) {
                    const bookingService = new BookingService();
                    for (const booking of longRunningBookings) {
                        try {
                            await bookingService.updateBookingStatus(
                                booking.id,
                                'COMPLETED',
                                'SYSTEM',
                                'Automatically completed after 48 hours in progress.'
                            );
                            logger.info(`Auto-completed booking ${booking.id} after 48 hours.`);
                        } catch (err) {
                            logger.error(`Failed to auto-complete booking ${booking.id}:`, err);
                        }
                    }
                }
            } catch (error) {
                logger.error('Error in Auto Complete Job:', error);
            }
        });
        this.jobs.push(autoCompleteJob);

        // Run every hour to release held funds (cooling period check)
        const releaseFundsJob = cron.schedule('0 * * * *', async () => {
            logger.info('Running release held funds job...');
            try {
                const walletService = new WalletService();
                const count = await walletService.releaseHeldFunds();
                // @ts-ignore
                if (count > 0) {
                    logger.info(`Released funds for ${count} transactions`);
                }
            } catch (error) {
                logger.error('Error releasing held funds:', error);
            }
        });

        this.jobs.push(releaseFundsJob);

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
