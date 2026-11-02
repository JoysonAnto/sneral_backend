import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCouponValidator, updateCouponValidator } from '../validators/coupon.validator';

const router = Router();
const couponController = new CouponController();

// All routes require ADMIN or SUPER_ADMIN authentication
router.use(authenticateToken);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Coupon stats
router.get('/stats', couponController.getCouponStats);

// List all coupons
router.get('/', couponController.getAllCoupons);

// Create new coupon
router.post('/', validate(createCouponValidator), couponController.createCoupon);

// Get single coupon details
router.get('/:id', couponController.getCouponById);

// Update coupon
router.put('/:id', validate(updateCouponValidator), couponController.updateCoupon);

// Toggle coupon status
router.patch('/:id/status', couponController.toggleCouponStatus);

// Delete coupon (safe / non-destructive)
router.delete('/:id', couponController.deleteCoupon);

// Get redemption history for a coupon
router.get('/:id/redemptions', couponController.getCouponRedemptions);

export default router;
