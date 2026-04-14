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

    assignPartnerCategory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { partnerId, categoryId, partnerType, assignAllServices } = req.body;
            const result = await this.adminService.assignPartnerCategory(
                partnerId,
                partnerType || 'SERVICE',
                categoryId,
                assignAllServices === true
            );
            res.json(successResponse(result, 'Partner category assigned successfully'));
        } catch (error) {
            next(error);
        }
    };

    getPlatformSettings = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const { PlatformSettingsService } = await import('../services/platform-settings.service');
            const settings = await new PlatformSettingsService().getAllSettings();
            res.json(successResponse(settings, 'Platform settings retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updatePlatformSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // req.body: { commission_rate?: number, gst_rate?: number, gst_enabled?: boolean }
            const { commission_rate, gst_rate, gst_enabled } = req.body;

            const updates: { key: string; value: string; description?: string }[] = [];

            if (commission_rate !== undefined) {
                const rate = parseFloat(commission_rate);
                if (isNaN(rate) || rate < 0 || rate > 1) {
                    res.status(400).json({ success: false, message: 'commission_rate must be between 0 and 1 (e.g., 0.15 for 15%)' });
                    return;
                }
                updates.push({ key: 'commission_rate', value: rate.toString(), description: `Platform Commission (${(rate * 100).toFixed(1)}%)` });
                updates.push({ key: 'commission_label', value: `Platform Commission (${(rate * 100).toFixed(1)}%)` });
            }

            if (gst_rate !== undefined) {
                const rate = parseFloat(gst_rate);
                if (isNaN(rate) || rate < 0 || rate > 1) {
                    res.status(400).json({ success: false, message: 'gst_rate must be between 0 and 1 (e.g., 0.18 for 18%)' });
                    return;
                }
                updates.push({ key: 'gst_rate', value: rate.toString(), description: `GST Rate (${(rate * 100).toFixed(1)}%)` });
                updates.push({ key: 'gst_label', value: `GST (${(rate * 100).toFixed(1)}%)` });
            }

            if (gst_enabled !== undefined) {
                updates.push({ key: 'gst_enabled', value: String(gst_enabled === true || gst_enabled === 'true') });
            }

            if (updates.length === 0) {
                res.status(400).json({ success: false, message: 'No valid settings provided to update' });
                return;
            }

            const { PlatformSettingsService } = await import('../services/platform-settings.service');
            const result = await new PlatformSettingsService().updateSettings(updates, req.user!.userId);
            res.json(successResponse(result, 'Platform settings updated successfully'));
        } catch (error) {
            next(error);
        }
    };
}

