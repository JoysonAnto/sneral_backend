import prisma from '../config/database';
import { BadRequestError } from '../utils/errors';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay (if credentials are available)
let razorpay: Razorpay | null = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
}

interface CreatePaymentData {
    bookingId: string;
    amount: number;
    method: 'RAZORPAY' | 'STRIPE' | 'WALLET';
    type: 'ADVANCE' | 'FULL';
}

export class PaymentService {
    async createPayment(userId: string, data: CreatePaymentData) {
        // Verify booking exists and belongs to user
        const booking = await prisma.booking.findUnique({
            where: { id: data.bookingId },
        });

        if (!booking) {
            throw new BadRequestError('Booking not found');
        }

        if (booking.customer_id !== userId) {
            throw new BadRequestError('Unauthorized: Booking does not belong to you');
        }

        // Calculate amount based on type
        const amount = data.type === 'ADVANCE'
            ? booking.advance_amount
            : booking.remaining_amount;

        if (data.method === 'WALLET') {
            // Process wallet payment
            const { WalletService } = await import('./wallet.service');
            const walletService = new WalletService();

            await walletService.processBookingPayment(userId, data.bookingId, amount);

            // Create payment record
            const payment = await prisma.payment.create({
                data: {
                    booking_id: data.bookingId,
                    user_id: userId,
                    amount,
                    payment_method: 'WALLET',
                    payment_status: 'COMPLETED',
                    transaction_id: `WALLET_${Date.now()}`,
                },
            });

            // Update booking payment status
            await prisma.booking.update({
                where: { id: data.bookingId },
                data: {
                    payment_status: data.type === 'FULL' ? 'COMPLETED' : 'PARTIAL',
                },
            });

            return {
                paymentId: payment.id,
                amount: payment.amount,
                currency: 'INR',
                status: 'COMPLETED',
                method: 'WALLET',
                message: 'Payment successful via wallet',
            };
        } else if (data.method === 'RAZORPAY') {
            if (!razorpay) {
                throw new BadRequestError('Razorpay not configured');
            }

            // Create Razorpay order
            const order = await razorpay.orders.create({
                amount: amount * 100, // Razorpay expects amount in paise
                currency: 'INR',
                receipt: `ORDER_${data.bookingId}_${Date.now()}`,
                notes: {
                    bookingId: data.bookingId,
                    userId: userId,
                    type: data.type,
                },
            });

            // Create payment record
            const payment = await prisma.payment.create({
                data: {
                    booking_id: data.bookingId,
                    user_id: userId,
                    amount,
                    payment_method: 'CARD', // Razorpay can be card/UPI/etc
                    payment_status: 'PENDING',
                    razorpay_order_id: order.id,
                },
            });

            return {
                paymentId: payment.id,
                orderId: order.id,
                amount: amount,
                currency: 'INR',
                status: 'PENDING',
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                message: 'Payment order created successfully',
            };
        } else {
            throw new BadRequestError('Payment method not supported yet');
        }
    }

    async verifyPayment(paymentId: string, orderId: string, signature: string, userId: string) {
        if (!razorpay) {
            throw new BadRequestError('Razorpay not configured');
        }

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { booking: true },
        });

        if (!payment) {
            throw new BadRequestError('Payment not found');
        }

        if (payment.user_id !== userId) {
            throw new BadRequestError('Unauthorized');
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        if (generatedSignature !== signature) {
            // Update payment as failed
            await prisma.payment.update({
                where: { id: paymentId },
                data: { payment_status: 'FAILED' },
            });
            throw new BadRequestError('Invalid payment signature');
        }

        // Payment verified - update records
        await prisma.$transaction(async (tx) => {
            // Update payment
            await tx.payment.update({
                where: { id: paymentId },
                data: {
                    payment_status: 'COMPLETED',
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signature,
                },
            });

            // Update booking
            await tx.booking.update({
                where: { id: payment.booking_id },
                data: {
                    payment_status: payment.amount === payment.booking.total_amount
                        ? 'COMPLETED'
                        : 'PARTIAL',
                },
            });

            // Create transaction record
            await tx.transaction.create({
                data: {
                    user_id: userId,
                    booking_id: payment.booking_id,
                    type: 'BOOKING_PAYMENT',
                    amount: payment.amount,
                    description: `Payment for booking #${payment.booking.booking_number}`,
                    balance_before: 0,
                    balance_after: 0,
                },
            });
        });

        return {
            status: 'COMPLETED',
            paymentId,
            message: 'Payment verified successfully',
        };
    }

    async processRefund(bookingId: string, amount: number, reason: string, adminId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                payments: {
                    where: { payment_status: 'COMPLETED' },
                },
                customer: true,
            },
        });

        if (!booking) {
            throw new BadRequestError('Booking not found');
        }

        const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);

        if (amount > totalPaid) {
            throw new BadRequestError('Refund amount exceeds paid amount');
        }

        // Process refund via wallet (simplest approach)
        const { WalletService } = await import('./wallet.service');
        const walletService = new WalletService();

        // Credit to customer wallet
        await walletService.creditPartnerEarnings(
            booking.customer_id,
            bookingId,
            amount
        );

        // Create refund payment record
        const refund = await prisma.payment.create({
            data: {
                booking_id: bookingId,
                user_id: booking.customer_id,
                amount: -amount, // Negative for refund
                payment_method: 'WALLET',
                payment_status: 'COMPLETED',
                transaction_id: `REFUND_${Date.now()}`,
            },
        });

        // Update booking
        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                refund_amount: { increment: amount },
            },
        });

        // TODO: Send notification to customer

        return {
            refundId: refund.id,
            amount,
            status: 'COMPLETED',
            method: 'WALLET',
            message: 'Refund processed successfully',
        };
    }

    async getPaymentHistory(userId: string, filters: any) {
        const { page = 1, limit = 20, status } = filters;
        const skip = (page - 1) * limit;

        let where: any = { user_id: userId };

        if (status) {
            where.payment_status = status;
        }

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    booking: {
                        select: {
                            booking_number: true,
                            total_amount: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            prisma.payment.count({ where }),
        ]);

        return {
            payments: payments.map(p => ({
                id: p.id,
                bookingNumber: p.booking?.booking_number,
                amount: p.amount,
                method: p.payment_method,
                status: p.payment_status,
                transactionId: p.transaction_id || p.razorpay_payment_id,
                createdAt: p.created_at,
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
            },
        };
    }

    async handleRazorpayWebhook(payload: any, signature: string) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error('Razorpay webhook secret not configured');
        }

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex');

        if (expectedSignature !== signature) {
            throw new BadRequestError('Invalid webhook signature');
        }

        const event = payload.event;
        const paymentData = payload.payload.payment.entity;

        if (event === 'payment.captured' || event === 'payment.authorized') {
            const orderId = paymentData.order_id;
            const paymentId = paymentData.id;

            // Find payment record
            const payment = await prisma.payment.findFirst({
                where: { razorpay_order_id: orderId },
                include: { booking: true },
            });

            if (payment && payment.payment_status === 'PENDING') {
                // Process payment success (reusing logic or calling verify internally)
                // Actually, webhooks are a fallback for verify.
                await this.verifyPayment(payment.id, orderId, 'WEBHOOK_VERIFIED', payment.user_id!);
            }
        } else if (event === 'payment.failed') {
            const orderId = paymentData.order_id;
            await prisma.payment.updateMany({
                where: { razorpay_order_id: orderId, payment_status: 'PENDING' },
                data: { payment_status: 'FAILED' },
            });
        }

        return { received: true };
    }
}
