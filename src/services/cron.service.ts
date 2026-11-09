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

        // Run every 10 seconds to process progressive wave radius expansions & manual dispatch alerts
        const progressiveSearchWaveJob = cron.schedule('*/10 * * * * *', async () => {
            try {
                const now = Date.now();

                // Find active instant bookings searching for a partner
                const searchingBookings = await prisma.booking.findMany({
                    where: {
                        status: 'SEARCHING_PARTNER',
                        partner_id: null,
                    },
                    include: {
                        items: {
                            include: {
                                service: {
                                    include: { category: true }
                                }
                            }
                        },
                        customer: {
                            select: { id: true, full_name: true }
                        },
                        activity_logs: true
                    }
                });

                if (searchingBookings.length === 0) return;

                const { PartnerMatchingService } = await import('./partner-matching.service');
                const { getIO } = await import('../socket/socket.server');
                const matchingService = new PartnerMatchingService();
                const io = getIO();

                for (const booking of searchingBookings) {
                    try {
                        const elapsedSeconds = (now - booking.created_at.getTime()) / 1000;
                        const serviceItem = booking.items[0];
                        const serviceName = serviceItem?.service?.name || 'Service';
                        const currentRadius = (booking as any).current_search_radius || 2.0;
                        const logActions = new Set(booking.activity_logs.map(l => l.action));

                        // 1. TIMEOUT AT 5 MINUTES (300 SECONDS) -> PARTNER_NOT_FOUND
                        if (elapsedSeconds >= 300) {
                            logger.warn(`[SEARCH_EXPANSION] Booking #${booking.booking_number} reached 5m timeout without acceptance. Marking PARTNER_NOT_FOUND.`);
                            await prisma.booking.update({
                                where: { id: booking.id },
                                data: {
                                    status: 'PARTNER_NOT_FOUND',
                                    status_history: {
                                        create: {
                                            status: 'PARTNER_NOT_FOUND',
                                            changed_by: 'SYSTEM',
                                            notes: 'No partner accepted the booking within 5 minutes across 12 km radius'
                                        }
                                    }
                                }
                            });

                            io.of('/customer').to(booking.customer_id).emit('booking:status_change', {
                                bookingId: booking.id,
                                status: 'PARTNER_NOT_FOUND',
                                message: 'No professional is currently available. Please retry or schedule for later.'
                            });
                            io.of('/customer').to(booking.customer_id).emit('booking:not_found', {
                                bookingId: booking.id,
                                bookingNumber: booking.booking_number,
                            });
                            continue;
                        }

                        // 2. ALERT AT 3 MINUTES (180 SECONDS) -> MANUAL DISPATCH REQUIRED
                        if (elapsedSeconds >= 180 && !logActions.has('ADMIN_MANUAL_DISPATCH_ALERT_3MIN')) {
                            logger.info(`🚨 [MANUAL_DISPATCH] Booking #${booking.booking_number} unassigned after 3m! Emitting admin:manual_dispatch_required.`);
                            await prisma.bookingActivityLog.create({
                                data: {
                                    booking_id: booking.id,
                                    actor_type: 'SYSTEM',
                                    actor_id: 'SYSTEM',
                                    action: 'ADMIN_MANUAL_DISPATCH_ALERT_3MIN',
                                    details: {
                                        elapsedSeconds: Math.round(elapsedSeconds),
                                        currentRadius,
                                        timestamp: new Date().toISOString()
                                    }
                                }
                            });

                            io.of('/admin').to('admin').emit('admin:manual_dispatch_required', {
                                bookingId: booking.id,
                                bookingNumber: booking.booking_number,
                                serviceName,
                                customerName: booking.customer.full_name,
                                serviceAddress: booking.service_address,
                                totalAmount: booking.total_amount,
                                elapsedSeconds: Math.round(elapsedSeconds),
                                currentRadius,
                                message: `⚠️ Urgent: Booking #${booking.booking_number} unassigned after 3 minutes across ${currentRadius}km. Manual dispatch required!`
                            });
                        }

                        // 3. WAVE 4: EXPAND TO 12 KM AT 90 SECONDS (Includes Busy Partners Ending Soon)
                        if (elapsedSeconds >= 90 && currentRadius < 12.0) {
                            logger.info(`🌊 [WAVE 4] Expanding booking #${booking.booking_number} to 12 km and notifying busy partners ending soon.`);
                            await prisma.booking.update({
                                where: { id: booking.id },
                                data: { current_search_radius: 12.0 } as any
                            });

                            io.of('/customer').to(booking.customer_id).emit('booking:search_expanded', {
                                bookingId: booking.id,
                                wave: 4,
                                currentRadius: 12.0,
                                message: 'Connecting with experts within 12 km (including technicians finishing nearby)...'
                            });

                            // A. Notify available partners in 12 km
                            const wave4Partners = await matchingService.findAvailablePartners(booking.id, 12.0);
                            for (const partner of wave4Partners) {
                                io.of('/partner').to(partner.user_id).emit('new_job', {
                                    id: booking.id,
                                    bookingNumber: booking.booking_number,
                                    service: { name: serviceName, category: serviceItem?.service?.category?.name || 'Home' },
                                    customer: { name: booking.customer.full_name },
                                    location: booking.service_address,
                                    amount: booking.total_amount,
                                    distance: partner.distance,
                                    isWave4: true
                                });
                            }

                            // B. Notify busy partners ending soon
                            const busyCandidates = await matchingService.findBusyPartnersEndingSoon(booking.id, 12.0);
                            for (const bp of busyCandidates) {
                                io.of('/partner').to(bp.user_id).emit('booking:next_job_available', {
                                    id: booking.id,
                                    bookingNumber: booking.booking_number,
                                    serviceName,
                                    customerName: booking.customer.full_name,
                                    location: booking.service_address,
                                    amount: booking.total_amount,
                                    distanceKm: bp.distance,
                                    message: '🔔 Upcoming Next Job Nearby! Starts right after your current service. Tap to queue this booking!'
                                });
                            }
                            continue;
                        }

                        // 4. WAVE 3: EXPAND TO 8 KM AT 60 SECONDS
                        if (elapsedSeconds >= 60 && currentRadius < 8.0) {
                            logger.info(`🌊 [WAVE 3] Expanding booking #${booking.booking_number} to 8 km.`);
                            await prisma.booking.update({
                                where: { id: booking.id },
                                data: { current_search_radius: 8.0 } as any
                            });

                            io.of('/customer').to(booking.customer_id).emit('booking:search_expanded', {
                                bookingId: booking.id,
                                wave: 3,
                                currentRadius: 8.0,
                                message: 'Broadening reach to 8 km...'
                            });

                            const wave3Partners = await matchingService.findAvailablePartners(booking.id, 8.0);
                            for (const partner of wave3Partners) {
                                io.of('/partner').to(partner.user_id).emit('new_job', {
                                    id: booking.id,
                                    bookingNumber: booking.booking_number,
                                    service: { name: serviceName, category: serviceItem?.service?.category?.name || 'Home' },
                                    customer: { name: booking.customer.full_name },
                                    location: booking.service_address,
                                    amount: booking.total_amount,
                                    distance: partner.distance,
                                });
                            }
                            continue;
                        }

                        // 5. WAVE 2: EXPAND TO 5 KM AT 30 SECONDS
                        if (elapsedSeconds >= 30 && currentRadius < 5.0) {
                            logger.info(`🌊 [WAVE 2] Expanding booking #${booking.booking_number} to 5 km.`);
                            await prisma.booking.update({
                                where: { id: booking.id },
                                data: { current_search_radius: 5.0 } as any
                            });

                            io.of('/customer').to(booking.customer_id).emit('booking:search_expanded', {
                                bookingId: booking.id,
                                wave: 2,
                                currentRadius: 5.0,
                                message: 'Expanding search to 5 km...'
                            });

                            const wave2Partners = await matchingService.findAvailablePartners(booking.id, 5.0);
                            for (const partner of wave2Partners) {
                                io.of('/partner').to(partner.user_id).emit('new_job', {
                                    id: booking.id,
                                    bookingNumber: booking.booking_number,
                                    service: { name: serviceName, category: serviceItem?.service?.category?.name || 'Home' },
                                    customer: { name: booking.customer.full_name },
                                    location: booking.service_address,
                                    amount: booking.total_amount,
                                    distance: partner.distance,
                                });
                            }
                        }
                    } catch (bErr) {
                        logger.error(`Error in progressive search wave for booking ${booking.id}:`, bErr);
                    }
                }
            } catch (error) {
                logger.error('Error in Progressive Search Wave Job:', error);
            }
        });
        this.jobs.push(progressiveSearchWaveJob);

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

        // Run daily at 1:00 AM to evaluate pending partner referrals (e.g. 30 days active + 10 jobs)
        const partnerReferralEvalJob = cron.schedule('0 1 * * *', async () => {
            logger.info('Running partner referral evaluation job...');
            try {
                const { referralService } = await import('./referral.service');
                await referralService.evaluateAllPendingPartnerReferrals();
            } catch (error) {
                logger.error('Error evaluating partner referrals:', error);
            }
        }, {
            timezone: 'Asia/Kolkata'
        });

        this.jobs.push(partnerReferralEvalJob);

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
