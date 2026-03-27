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
import cashfreeRoutes from './cashfree.routes';
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
import publicRoutes from './public.routes';
import businessPartnerRoutes from './business-partner.routes';
import locationTrackingRoutes from './location-tracking.routes';
import roleRoutes from './role.routes';
import addressRoutes from './address.routes';
import servicePartnerRoutes from './service-partner.routes';


const router = Router();

// Health check
router.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// 1. PUBLIC ROUTES (No Auth Required)
router.use('/public', publicRoutes);
router.use('/public/locations', publicLocationRoutes);
router.use('/categories', serviceController.getAllCategories); // Legacy compatibility

// 2. AUTH & USER ROUTES
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/addresses', addressRoutes);

// 3. SERVICE & BOOKING ROUTES
router.use('/services', serviceRoutes);
router.use('/bookings', bookingRoutes);
router.use('/jobs', bookingRoutes); // Alias for partner app

// 4. PARTNER & WALLET ROUTES
router.use('/partners', partnerRoutes);
router.use('/partner', servicePartnerRoutes);
router.use('/wallet', walletRoutes);
router.use('/kyc', kycRoutes);
router.use('/kyc/cashfree', cashfreeRoutes);
router.use('/payments', paymentRoutes);
router.use('/payouts', payoutRoutes);

// 5. LOCATION & TRACKING
router.use('/locations', locationRoutes);
router.use('/tracking', locationTrackingRoutes);

// 6. COMMUNICATION
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);

// 7. ADMIN & ROLES
router.use('/admin', adminRoutes);
router.use('/roles', roleRoutes);
router.use('/business-partners', businessPartnerRoutes);

// 8. OFFLINE BILLING & TEAM (MESSY CATCH-ALLS - KEEP AT END)
// Note: These routers use global middleware and should ideally be prefixed
router.use(offlineCustomerRoutes);
router.use(offlineInvoiceRoutes);
router.use(recurringInvoiceRoutes);
router.use(teamManagementRoutes);

export default router;

