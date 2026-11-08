import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { partnerRewardService } from '../services/partner-reward.service';
import { referralService } from '../services/referral.service';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../utils/errors';

export class AdminManagementController {
    // ============================================
    // SURGE AREAS MANAGEMENT
    // ============================================
    getSurgeAreas = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const areas = await prisma.surgeArea.findMany({
                orderBy: { created_at: 'desc' }
            });
            res.json(successResponse(areas, 'Surge areas retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createSurgeArea = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, city, latitude, longitude, radius_km, surge_multiplier, bonus_per_order, is_active } = req.body;
            if (!name || !city || latitude === undefined || longitude === undefined) {
                throw new BadRequestError('Name, city, latitude, and longitude are required');
            }

            const area = await prisma.surgeArea.create({
                data: {
                    name,
                    city,
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    radius_km: radius_km ? parseFloat(radius_km) : 5,
                    surge_multiplier: surge_multiplier ? parseFloat(surge_multiplier) : 1.3,
                    bonus_per_order: bonus_per_order ? parseFloat(bonus_per_order) : 50,
                    is_active: is_active !== undefined ? Boolean(is_active) : true,
                }
            });
            res.status(201).json(successResponse(area, 'Surge area created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateSurgeArea = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { name, city, latitude, longitude, radius_km, surge_multiplier, bonus_per_order, is_active } = req.body;

            const area = await prisma.surgeArea.update({
                where: { id },
                data: {
                    ...(name && { name }),
                    ...(city && { city }),
                    ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
                    ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
                    ...(radius_km !== undefined && { radius_km: parseFloat(radius_km) }),
                    ...(surge_multiplier !== undefined && { surge_multiplier: parseFloat(surge_multiplier) }),
                    ...(bonus_per_order !== undefined && { bonus_per_order: parseFloat(bonus_per_order) }),
                    ...(is_active !== undefined && { is_active: Boolean(is_active) }),
                }
            });
            res.json(successResponse(area, 'Surge area updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteSurgeArea = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await prisma.surgeArea.delete({ where: { id } });
            res.json(successResponse(null, 'Surge area deleted successfully'));
        } catch (error) {
            next(error);
        }
    };

    // ============================================
    // REWARD RULES & CLAIMS MANAGEMENT
    // ============================================
    getRewardRules = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const rules = await partnerRewardService.getAllRules();
            res.json(successResponse(rules, 'Reward rules retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createRewardRule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rule = await partnerRewardService.createRule(req.body);
            res.status(201).json(successResponse(rule, 'Reward rule created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateRewardRule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rule = await partnerRewardService.updateRule(req.params.id, req.body);
            res.json(successResponse(rule, 'Reward rule updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteRewardRule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await partnerRewardService.deleteRule(req.params.id);
            res.json(successResponse(null, 'Reward rule deleted successfully'));
        } catch (error) {
            next(error);
        }
    };

    getRewardClaims = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
            const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
            const partnerId = req.query.partnerId as string | undefined;

            const result = await partnerRewardService.getRewardClaims({ limit, offset, partnerId });
            res.json(successResponse(result, 'Reward claims retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // ============================================
    // REFERRAL PROGRAM CONFIG & TRACKING
    // ============================================
    getReferralConfig = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const config = await referralService.getOrCreateConfig();
            res.json(successResponse(config, 'Referral configuration retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateReferralConfig = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const config = await referralService.updateConfig(req.body);
            res.json(successResponse(config, 'Referral configuration updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    getReferralLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
            const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
            const status = req.query.status as string | undefined;

            const result = await referralService.getAllTrackings({ limit, offset, status });
            res.json(successResponse(result, 'Referral tracking logs retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // ============================================
    // AGENCY / BUSINESS PARTNER FLEET MANAGEMENT
    // ============================================
    getAgencies = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const agencies = await prisma.businessPartner.findMany({
                include: {
                    user: { select: { full_name: true, email: true, phone_number: true, is_active: true } },
                    _count: { select: { service_partners: true, bookings: true } },
                    service_partners: {
                        select: {
                            id: true,
                            availability_status: true,
                            avg_rating: true,
                            user: { select: { full_name: true, phone_number: true } }
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            });
            res.json(successResponse(agencies, 'Agencies retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getAgencyTechnicians = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const technicians = await prisma.servicePartner.findMany({
                where: { business_partner_id: id },
                include: {
                    user: { select: { full_name: true, email: true, phone_number: true, is_active: true } },
                    _count: {
                        select: {
                            bookings: { where: { status: { in: ['COMPLETED', 'RATED'] } } }
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            });
            res.json(successResponse(technicians, 'Agency technicians retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    linkTechnicianToAgency = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params; // agencyId
            const { partnerId } = req.body;

            const updatedPartner = await prisma.servicePartner.update({
                where: { id: partnerId },
                data: { business_partner_id: id }
            });

            res.json(successResponse(updatedPartner, 'Technician linked to agency successfully'));
        } catch (error) {
            next(error);
        }
    };
}

export const adminManagementController = new AdminManagementController();
