import { Router } from 'express';
import authRoutes from './auth.routes';
import bookingRoutes from './booking.routes';
import serviceRoutes from './service.routes';
import partnerRoutes from './partner.routes';
import walletRoutes from './wallet.routes';
import userRoutes from './user.routes';
import notificationRoutes from './notification.routes';
import messageRoutes from './message.routes';
import adminRoutes from './admin.routes';
import kycRoutes from './kyc.routes';
import { ServiceController } from '../controllers/service.controller';
const serviceController = new ServiceController();
import paymentRoutes from './payment.routes';
import locationRoutes from './location.routes';
import offlineCustomerRoutes from './offline-customer.routes';
import offlineInvoiceRoutes from './offline-invoice.routes';
import recurringInvoiceRoutes from './recurring-invoice.routes';
import teamManagementRoutes from './team-management.routes';
import payoutRoutes from './payout.routes';
import publicLocationRoutes from './public-location.routes';
import businessPartnerRoutes from './business-partner.routes';
import locationTrackingRoutes from './location-tracking.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/categories', serviceController.getAllCategories);
router.use('/bookings', bookingRoutes);
router.use('/services', serviceRoutes);
router.use('/partners', partnerRoutes);
router.use('/wallet', walletRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/admin', adminRoutes);
router.use('/business-partners', businessPartnerRoutes);
router.use('/kyc', kycRoutes);
router.use('/payments', paymentRoutes);
router.use('/locations', locationRoutes);
router.use('/public/locations', publicLocationRoutes);
router.use('/payouts', payoutRoutes);

// Service Partner Routes (for mobile app)
import servicePartnerRoutes from './service-partner.routes';
router.use('/partner', servicePartnerRoutes);

// Jobs endpoint (alias for bookings for service partner app)
router.use('/jobs', bookingRoutes);

// Offline Billing Routes
router.use(offlineCustomerRoutes);
router.use(offlineInvoiceRoutes);
router.use(recurringInvoiceRoutes);

// Team Management Routes
router.use(teamManagementRoutes);

// Location Tracking Routes
router.use('/tracking', locationTrackingRoutes);

export default router;

