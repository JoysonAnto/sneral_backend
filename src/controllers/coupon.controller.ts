import { Request, Response, NextFunction } from 'express';
import { CouponService } from '../services/coupon.service';
import { successResponse } from '../utils/response';

export class CouponController {
    private couponService: CouponService;

    constructor() {
        this.couponService = new CouponService();
    }

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    createCoupon = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const coupon = await this.couponService.createCoupon(req.body);
            res.status(201).json(successResponse(coupon, 'Coupon created successfully'));
        } catch (error) {
            next(error);
        }
    };

    getAllCoupons = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { status, search, page, limit } = req.query;
            const result = await this.couponService.getAllCoupons({
                status: status as any,
                search: search as string,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
            });
            res.json(successResponse(result.coupons, 'Coupons retrieved successfully', result.pagination));
        } catch (error) {
            next(error);
        }
    };

    getCouponById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const coupon = await this.couponService.getCouponById(id);
            res.json(successResponse(coupon, 'Coupon details retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const coupon = await this.couponService.updateCoupon(id, req.body);
            res.json(successResponse(coupon, 'Coupon updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    toggleCouponStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;
            const coupon = await this.couponService.toggleCouponStatus(id, isActive);
            res.json(successResponse(coupon, `Coupon ${coupon.is_active ? 'activated' : 'deactivated'} successfully`));
        } catch (error) {
            next(error);
        }
    };

    deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const result = await this.couponService.deleteCoupon(id);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    getCouponRedemptions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { page, limit } = req.query;
            const result = await this.couponService.getCouponRedemptions(
                id,
                page ? Number(page) : 1,
                limit ? Number(limit) : 20
            );
            res.json(successResponse(result.redemptions, 'Redemptions retrieved successfully', result.pagination));
        } catch (error) {
            next(error);
        }
    };

    getCouponStats = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const stats = await this.couponService.getCouponStats();
            res.json(successResponse(stats, 'Coupon statistics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // ==========================================
    // USER / CHECKOUT ENDPOINTS
    // ==========================================

    getAvailableCoupons = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.userId;
            const { serviceId, amount } = req.query;
            const coupons = await this.couponService.getAvailableCoupons(
                userId,
                serviceId as string,
                amount ? Number(amount) : undefined
            );
            res.json(successResponse(coupons, 'Available coupons retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.userId;
            const result = await this.couponService.validateCoupon(userId, req.body);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };
}
