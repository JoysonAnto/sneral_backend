import { getFirebaseMessaging } from '../config/firebase';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Payload shapes for each notification category.
 * The `data` map (string→string) is forwarded to the mobile app so it
 * can decide how to route the user after tapping the notification.
 */
export interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
    priority?: 'high' | 'normal';
}

// ─────────────────────────────────────────────────────────
// LOW-LEVEL SEND HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Send a push notification to a single FCM token.
 * Silently swips invalid tokens (token not found / unregistered).
 */
export async function sendPushToToken(token: string, payload: PushPayload): Promise<boolean> {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
        logger.warn('[FCM] Firebase not initialized – skipping push notification');
        return false;
    }

    try {
        await messaging.send({
            token,
            notification: {
                title: payload.title,
                body: payload.body,
                imageUrl: payload.imageUrl,
            },
            data: payload.data ?? {},
            android: {
                priority: payload.priority ?? 'high',
                ttl: 0, // Deliver immediately
                directBootOk: true,
                notification: {
                    sound: 'default',
                    channelId: payload.data?.type === 'NEW_BOOKING' ? 'job-requests' : 'snearal_notifications',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    visibility: 'public',
                    priority: 'max',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true,
                        'interruption-level': payload.priority === 'high' ? 'critical' : 'active',
                    },
                },
                headers: {
                    'apns-priority': payload.priority === 'high' ? '10' : '5',
                    'apns-push-type': 'alert',
                }
            },
        });
        return true;
    } catch (error: any) {
        const code = error?.errorInfo?.code as string | undefined;
        if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
        ) {
            logger.warn(`[FCM] Invalid token – will be cleared`);
            // Clear the stale token from the database
            await prisma.user.updateMany({
                where: { fcm_token: token },
                data: { fcm_token: null },
            });
        } else {
            logger.error('[FCM] Send error:', error?.message || error);
        }
        return false;
    }
}

/**
 * Send to multiple tokens at once (multicast).
 */
export async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<void> {
    const messaging = getFirebaseMessaging();
    if (!messaging || tokens.length === 0) return;

    const invalidTokens: string[] = [];

    try {
        const response = await messaging.sendEachForMulticast({
            tokens,
            notification: {
                title: payload.title,
                body: payload.body,
                imageUrl: payload.imageUrl,
            },
            data: payload.data ?? {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'snearal_notifications',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                },
            },
            apns: {
                payload: {
                    aps: { sound: 'default', badge: 1 },
                },
            },
        });

        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const code = resp.error?.code;
                if (
                    code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token'
                ) {
                    invalidTokens.push(tokens[idx]);
                }
            }
        });

        logger.info(`[FCM] Multicast sent: ${response.successCount} ok, ${response.failureCount} failed`);
    } catch (error) {
        logger.error('[FCM] Multicast error:', error);
    }

    // Purge stale tokens
    if (invalidTokens.length > 0) {
        await prisma.user.updateMany({
            where: { fcm_token: { in: invalidTokens } },
            data: { fcm_token: null },
        });
    }
}

// ─────────────────────────────────────────────────────────
// HELPERS TO LOOK UP TOKENS
// ─────────────────────────────────────────────────────────

async function getTokenForUser(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcm_token: true },
    });
    return user?.fcm_token ?? null;
}

async function getAdminTokens(): Promise<string[]> {
    const admins = await prisma.user.findMany({
        where: {
            role: { in: ['ADMIN', 'SUPER_ADMIN'] },
            fcm_token: { not: null },
            is_active: true,
        },
        select: { fcm_token: true },
    });
    return admins.map((a) => a.fcm_token!);
}

// ─────────────────────────────────────────────────────────
// THE MAIN FCM SERVICE CLASS
// ─────────────────────────────────────────────────────────

export class FcmService {

    // ── CUSTOMER NOTIFICATIONS ──────────────────────────

    /** Customer: booking created confirmation */
    async notifyCustomerBookingCreated(customerId: string, bookingNumber: string, bookingId: string) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '✅ Booking Confirmed!',
            body: `Your booking #${bookingNumber} has been placed. We are finding a technician for you.`,
            data: { type: 'BOOKING_CREATED', bookingId, screen: 'BookingDetail' },
        });
    }

    /** Customer: partner has been assigned */
    async notifyCustomerPartnerAssigned(
        customerId: string,
        bookingNumber: string,
        bookingId: string,
        partnerName: string,
    ) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '🔧 Technician Assigned',
            body: `${partnerName} has been assigned to your booking #${bookingNumber}.`,
            data: { type: 'BOOKING_ASSIGNED', bookingId, screen: 'BookingDetail' },
        });
    }

    /** Customer: partner accepted the job and is on the way */
    async notifyCustomerPartnerAccepted(
        customerId: string,
        bookingNumber: string,
        bookingId: string,
        partnerName: string,
    ) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '🚗 Technician On the Way',
            body: `${partnerName} has accepted your booking #${bookingNumber} and is heading your way.`,
            data: { type: 'PARTNER_ACCEPTED', bookingId, screen: 'BookingTracking' },
        });
    }

    /** Customer: partner arrived at location */
    async notifyCustomerPartnerArrived(
        customerId: string,
        bookingNumber: string,
        bookingId: string,
        partnerName: string,
    ) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '📍 Technician Arrived',
            body: `${partnerName} has arrived at your location for booking #${bookingNumber}.`,
            data: { type: 'PARTNER_ARRIVED', bookingId, screen: 'BookingDetail' },
        });
    }

    /** Customer: service has started */
    async notifyCustomerServiceStarted(
        customerId: string,
        bookingNumber: string,
        bookingId: string,
        partnerName: string,
    ) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '⚙️ Service Started',
            body: `${partnerName} has started your service for booking #${bookingNumber}.`,
            data: { type: 'BOOKING_STARTED', bookingId, screen: 'BookingDetail' },
        });
    }

    /** Customer: service completed */
    async notifyCustomerServiceCompleted(
        customerId: string,
        bookingNumber: string,
        bookingId: string,
    ) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '🎉 Service Completed!',
            body: `Your service for booking #${bookingNumber} is done. Please rate your experience.`,
            data: { type: 'BOOKING_COMPLETED', bookingId, screen: 'RateService' },
        });
    }

    /** Customer: booking cancelled */
    async notifyCustomerBookingCancelled(
        customerId: string,
        bookingNumber: string,
        bookingId: string,
        reason?: string,
    ) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '❌ Booking Cancelled',
            body: `Your booking #${bookingNumber} has been cancelled. ${reason ? `Reason: ${reason}` : ''}`.trim(),
            data: { type: 'BOOKING_CANCELLED', bookingId, screen: 'Bookings' },
        });
    }

    /** Customer: payment successful */
    async notifyCustomerPaymentSuccess(
        customerId: string,
        bookingNumber: string,
        bookingId: string,
        amount: number,
    ) {
        const token = await getTokenForUser(customerId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '💳 Payment Successful',
            body: `₹${amount.toFixed(2)} paid successfully for booking #${bookingNumber}.`,
            data: { type: 'PAYMENT_COMPLETED', bookingId, screen: 'PaymentReceipt' },
        });
    }

    // ── SERVICE PARTNER NOTIFICATIONS ───────────────────

    /** Partner: new job opportunity available */
    async notifyPartnerNewJob(
        partnerUserId: string,
        bookingId: string,
        bookingNumber: string,
        serviceName: string,
        amount: number,
        distanceKm?: number,
    ) {
        const token = await getTokenForUser(partnerUserId);
        if (!token) return;
        const distanceText = distanceKm !== undefined ? ` (${distanceKm.toFixed(1)} km away)` : '';
        await sendPushToToken(token, {
            title: '🆕 New Job Available',
            body: `${serviceName}${distanceText} – ₹${amount.toFixed(0)}. Tap to accept!`,
            data: { 
                type: 'NEW_BOOKING', 
                bookingId, 
                bookingNumber, 
                screen: 'JobDetail',
                fullScreen: 'true', // Trigger Wake-up UI
                price: amount.toString(),
                category: serviceName
            },
            priority: 'high',
        });
    }

    /** Partner: they were directly assigned to a booking */
    async notifyPartnerAssigned(
        partnerUserId: string,
        bookingId: string,
        bookingNumber: string,
        serviceName: string,
        customerName: string,
    ) {
        const token = await getTokenForUser(partnerUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '📋 Job Assigned to You',
            body: `You have been assigned to a ${serviceName} job for ${customerName}. Booking #${bookingNumber}.`,
            data: { type: 'BOOKING_ASSIGNED', bookingId, screen: 'JobDetail' },
        });
    }

    /** Partner: booking cancelled by customer / admin */
    async notifyPartnerBookingCancelled(
        partnerUserId: string,
        bookingNumber: string,
        bookingId: string,
    ) {
        const token = await getTokenForUser(partnerUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '❌ Booking Cancelled',
            body: `Booking #${bookingNumber} has been cancelled by the customer.`,
            data: { type: 'BOOKING_CANCELLED', bookingId, screen: 'MyJobs' },
        });
    }

    /** Partner: KYC approved */
    async notifyPartnerKycApproved(partnerUserId: string) {
        const token = await getTokenForUser(partnerUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '✅ KYC Approved',
            body: 'Your KYC verification has been approved. You can now start accepting jobs!',
            data: { type: 'KYC_APPROVED', screen: 'Dashboard' },
        });
    }

    /** Partner: KYC rejected */
    async notifyPartnerKycRejected(partnerUserId: string, reason?: string) {
        const token = await getTokenForUser(partnerUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '⚠️ KYC Action Required',
            body: reason
                ? `Your KYC was rejected: ${reason}. Please resubmit.`
                : 'Your KYC documents need attention. Please resubmit.',
            data: { type: 'KYC_REJECTED', screen: 'KycSubmission' },
        });
    }

    /** Partner: payout processed */
    async notifyPartnerPayoutProcessed(
        partnerUserId: string,
        amount: number,
        transactionId?: string,
    ) {
        const token = await getTokenForUser(partnerUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '💰 Payout Processed',
            body: `₹${amount.toFixed(2)} has been transferred to your bank account.`,
            data: { type: 'PAYOUT_PROCESSED', transactionId: transactionId ?? '', screen: 'Wallet' },
        });
    }

    /** Partner: team invitation from a business partner */
    async notifyPartnerTeamInvitation(
        partnerUserId: string,
        businessName: string,
        invitationId: string,
    ) {
        const token = await getTokenForUser(partnerUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '🤝 Team Invitation',
            body: `${businessName} has invited you to join their team.`,
            data: { type: 'TEAM_INVITATION', invitationId, screen: 'TeamInvitations' },
        });
    }

    // ── BUSINESS PARTNER NOTIFICATIONS ──────────────────

    /** Business Partner: new booking routed to their account */
    async notifyBusinessPartnerNewBooking(
        bpUserId: string,
        bookingId: string,
        bookingNumber: string,
        serviceName: string,
        customerName: string,
    ) {
        const token = await getTokenForUser(bpUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '📦 New Booking Received',
            body: `${customerName} booked ${serviceName}. Booking #${bookingNumber}. Assign a technician.`,
            data: { type: 'BOOKING_CREATED', bookingId, screen: 'BookingManagement' },
        });
    }

    /** Business Partner: booking completed under their account */
    async notifyBusinessPartnerBookingCompleted(
        bpUserId: string,
        bookingNumber: string,
        bookingId: string,
        amount: number,
    ) {
        const token = await getTokenForUser(bpUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '✅ Booking Completed',
            body: `Booking #${bookingNumber} completed. ₹${amount.toFixed(0)} earned.`,
            data: { type: 'BOOKING_COMPLETED', bookingId, screen: 'BusinessAnalytics' },
        });
    }

    /** Business Partner: KYC approved */
    async notifyBusinessPartnerKycApproved(bpUserId: string) {
        const token = await getTokenForUser(bpUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '✅ Business KYC Approved',
            body: 'Your business KYC has been approved. You can now receive bookings!',
            data: { type: 'KYC_APPROVED', screen: 'Dashboard' },
        });
    }

    /** Business Partner: KYC rejected */
    async notifyBusinessPartnerKycRejected(bpUserId: string, reason?: string) {
        const token = await getTokenForUser(bpUserId);
        if (!token) return;
        await sendPushToToken(token, {
            title: '⚠️ Business KYC Rejected',
            body: reason
                ? `KYC rejected: ${reason}. Please resubmit documents.`
                : 'Your business KYC documents need resubmission.',
            data: { type: 'KYC_REJECTED', screen: 'KycSubmission' },
        });
    }

    // ── ADMIN NOTIFICATIONS ──────────────────────────────

    /** Admin: broadcast to all admins when a new booking is created */
    async notifyAdminsNewBooking(bookingId: string, bookingNumber: string, customerName: string, amount: number) {
        const tokens = await getAdminTokens();
        if (tokens.length === 0) return;
        await sendPushToTokens(tokens, {
            title: '📬 New Booking',
            body: `${customerName} placed booking #${bookingNumber} for ₹${amount.toFixed(0)}.`,
            data: { type: 'BOOKING_CREATED', bookingId, screen: 'AdminBookings' },
        });
    }

    /** Admin: broadcast when no partner was found for a booking */
    async notifyAdminsPartnerNotFound(bookingId: string, bookingNumber: string) {
        const tokens = await getAdminTokens();
        if (tokens.length === 0) return;
        await sendPushToTokens(tokens, {
            title: '⚠️ Partner Not Found',
            body: `No available partner found for booking #${bookingNumber}. Manual action needed.`,
            data: { type: 'GENERAL', bookingId, screen: 'AdminBookings' },
        });
    }

    /** Admin: KYC submitted – awaiting review */
    async notifyAdminsKycSubmitted(applicantName: string, applicantId: string, entityType: 'partner' | 'business') {
        const tokens = await getAdminTokens();
        if (tokens.length === 0) return;
        await sendPushToTokens(tokens, {
            title: '📄 New KYC Submission',
            body: `${applicantName} (${entityType}) submitted KYC documents for review.`,
            data: { type: 'GENERAL', applicantId, entityType, screen: 'AdminKyc' },
        });
    }

    /** Admin: withdrawal request submitted */
    async notifyAdminsWithdrawalRequest(_userId: string, userName: string, amount: number, withdrawalId: string) {
        const tokens = await getAdminTokens();
        if (tokens.length === 0) return;
        await sendPushToTokens(tokens, {
            title: '💸 Withdrawal Request',
            body: `${userName} requested a ₹${amount.toFixed(0)} payout.`,
            data: { type: 'GENERAL', withdrawalId, screen: 'AdminWithdrawals' },
        });
    }
}

export const fcmService = new FcmService();
