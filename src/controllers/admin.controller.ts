import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { KYCService } from '../services/kyc.service';
import { successResponse } from '../utils/response';

export class AdminController {
    private adminService: AdminService;
    private kycService: KYCService;

    constructor() {
        this.adminService = new AdminService();
        this.kycService = new KYCService();
    }

    getDashboardStats = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const stats = await this.adminService.getDashboardStats();
            res.json(successResponse(stats, 'Dashboard statistics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    generateReport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { type, startDate, endDate } = req.query;
            const report = await this.adminService.generateReport(
                type as string,
                startDate as string,
                endDate as string
            );
            res.json(successResponse(report, 'Report generated successfully'));
        } catch (error) {
            next(error);
        }
    };

    getPendingPartners = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const partners = await this.adminService.getPendingPartners();
            res.json(successResponse(partners, 'Pending partners retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    approvePartner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const result = await this.kycService.verifyKYC(id, 'APPROVED', undefined, req.user!.userId);
            res.json(successResponse(result, 'Partner approved successfully'));
        } catch (error) {
            next(error);
        }
    };

    rejectPartner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const result = await this.kycService.verifyKYC(id, 'REJECTED', reason, req.user!.userId);
            res.json(successResponse(result, 'Partner rejected successfully'));
        } catch (error) {
            next(error);
        }
    };

    requestAction = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const result = await this.kycService.verifyKYC(id, 'ACTION_REQUIRED', reason, req.user!.userId);
            res.json(successResponse(result, 'Action request sent successfully'));
        } catch (error) {
            next(error);
        }
    };

    togglePartnerStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { type, isActive } = req.body;
            const result = await this.adminService.togglePartnerStatus(id, type, isActive);
            res.json(successResponse(result, `Partner ${isActive ? 'activated' : 'deactivated'} successfully`));
        } catch (error) {
            next(error);
        }
    };

    createCategory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const category = await this.adminService.createCategory(req.body);
            res.status(201).json(successResponse(category, 'Category created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateCategory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const category = await this.adminService.updateCategory(req.params.id, req.body);
            res.json(successResponse(category, 'Category updated successfully'));
        } catch (error) {
            next(error);
        }
    };
}
