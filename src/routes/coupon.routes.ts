import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { validateCouponValidator } from '../validators/coupon.validator';

const router = Router();
const couponController = new CouponController();

// All customer coupon endpoints require authentication
router.use(authenticateToken);

// List eligible available coupons for customer checkout
router.get('/available', couponController.getAvailableCoupons);

// Validate a coupon code and calculate discount
router.post('/validate', validate(validateCouponValidator), couponController.validateCoupon);

export default router;
