import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { partnerRewardService } from '../services/partner-reward.service';
import { referralService } from '../services/referral.service';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../utils/errors';
import { hashPassword } from '../utils/encryption';

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

    createAgency = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const {
                business_name,
                business_type,
                full_name,
                email,
                phone_number,
                password,
                commission_rate,
                gst_number,
                kyc_status,
                address,
                city,
                state,
                postal_code,
                bank_name,
                bank_account_number,
                bank_ifsc_code,
                bank_account_name,
                upi_id,
            } = req.body;

            if (!business_name || !full_name || !email) {
                throw new BadRequestError('Business name, contact person name, and email are required');
            }

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: email.toLowerCase().trim() }
            });

            if (existingUser) {
                throw new BadRequestError('A user account with this email already exists');
            }

            const rawPassword = password || `Snearal@${(phone_number || '1234567890').replace(/\D/g, '').slice(-4) || '2026'}`;
            const hashedPassword = await hashPassword(rawPassword);

            const result = await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: email.toLowerCase().trim(),
                        full_name: full_name.trim(),
                        phone_number: phone_number ? phone_number.trim() : null,
                        password: hashedPassword,
                        role: 'BUSINESS_PARTNER',
                        email_verified: true,
                        phone_verified: true,
                        is_active: true,
                    }
                });

                const rate = commission_rate !== undefined ? parseFloat(commission_rate) : 0.10;

                const agency = await tx.businessPartner.create({
                    data: {
                        user_id: user.id,
                        business_name: business_name.trim(),
                        business_type: business_type || null,
                        gst_number: gst_number ? gst_number.trim() : null,
                        commission_rate: rate,
                        kyc_status: (kyc_status as any) || 'APPROVED',
                        team_management_enabled: true,
                        address: address || null,
                        city: city || null,
                        state: state || null,
                        postal_code: postal_code || null,
                        bank_name: bank_name || null,
                        bank_account_number: bank_account_number || null,
                        bank_ifsc_code: bank_ifsc_code || null,
                        bank_account_name: bank_account_name || null,
                        upi_id: upi_id || null,
                    },
                    include: {
                        user: { select: { full_name: true, email: true, phone_number: true, is_active: true } },
                        _count: { select: { service_partners: true, bookings: true } }
                    }
                });

                return agency;
            });

            res.status(201).json(successResponse(result, 'Agency created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateAgency = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const {
                business_name,
                business_type,
                full_name,
                email,
                phone_number,
                password,
                commission_rate,
                gst_number,
                kyc_status,
                is_active,
                address,
                city,
                state,
                postal_code,
                bank_name,
                bank_account_number,
                bank_ifsc_code,
                bank_account_name,
                upi_id,
            } = req.body;

            const existingAgency = await prisma.businessPartner.findUnique({
                where: { id },
                include: { user: true }
            });

            if (!existingAgency) {
                throw new BadRequestError('Agency not found');
            }

            const result = await prisma.$transaction(async (tx) => {
                // Update User
                const userUpdateData: any = {};
                if (full_name !== undefined) userUpdateData.full_name = full_name.trim();
                if (email !== undefined && email.toLowerCase().trim() !== existingAgency.user.email) {
                    const checkEmail = await tx.user.findUnique({ where: { email: email.toLowerCase().trim() } });
                    if (checkEmail && checkEmail.id !== existingAgency.user_id) {
                        throw new BadRequestError('Email already taken by another account');
                    }
                    userUpdateData.email = email.toLowerCase().trim();
                }
                if (phone_number !== undefined) userUpdateData.phone_number = phone_number ? phone_number.trim() : null;
                if (is_active !== undefined) userUpdateData.is_active = Boolean(is_active);
                if (password && password.trim()) {
                    userUpdateData.password = await hashPassword(password.trim());
                }

                if (Object.keys(userUpdateData).length > 0) {
                    await tx.user.update({
                        where: { id: existingAgency.user_id },
                        data: userUpdateData
                    });
                }

                // Update BusinessPartner
                const agencyUpdateData: any = {};
                if (business_name !== undefined) agencyUpdateData.business_name = business_name.trim();
                if (business_type !== undefined) agencyUpdateData.business_type = business_type;
                if (gst_number !== undefined) agencyUpdateData.gst_number = gst_number ? gst_number.trim() : null;
                if (commission_rate !== undefined) agencyUpdateData.commission_rate = parseFloat(commission_rate);
                if (kyc_status !== undefined) agencyUpdateData.kyc_status = kyc_status;
                if (address !== undefined) agencyUpdateData.address = address;
                if (city !== undefined) agencyUpdateData.city = city;
                if (state !== undefined) agencyUpdateData.state = state;
                if (postal_code !== undefined) agencyUpdateData.postal_code = postal_code;
                if (bank_name !== undefined) agencyUpdateData.bank_name = bank_name;
                if (bank_account_number !== undefined) agencyUpdateData.bank_account_number = bank_account_number;
                if (bank_ifsc_code !== undefined) agencyUpdateData.bank_ifsc_code = bank_ifsc_code;
                if (bank_account_name !== undefined) agencyUpdateData.bank_account_name = bank_account_name;
                if (upi_id !== undefined) agencyUpdateData.upi_id = upi_id;

                const updated = await tx.businessPartner.update({
                    where: { id },
                    data: agencyUpdateData,
                    include: {
                        user: { select: { full_name: true, email: true, phone_number: true, is_active: true } },
                        _count: { select: { service_partners: true, bookings: true } }
                    }
                });

                return updated;
            });

            res.json(successResponse(result, 'Agency updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteAgency = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const existingAgency = await prisma.businessPartner.findUnique({
                where: { id },
                include: { user: true }
            });

            if (!existingAgency) {
                throw new BadRequestError('Agency not found');
            }

            await prisma.$transaction(async (tx) => {
                // Detach all service partners from this agency
                await tx.servicePartner.updateMany({
                    where: { business_partner_id: id },
                    data: { business_partner_id: null }
                });

                // Deactivate the user
                await tx.user.update({
                    where: { id: existingAgency.user_id },
                    data: { is_active: false }
                });

                // Delete the agency record
                await tx.businessPartner.delete({
                    where: { id }
                });
            });

            res.json(successResponse(null, 'Agency deleted successfully'));
        } catch (error) {
            next(error);
        }
    };

    // ============================================
    // MERCHANDISE / EQUIPMENT STORE MANAGEMENT
    // ============================================
    getMerchandiseKits = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const { partnerService } = await import('../services/partner.service');
            await partnerService.ensureDefaultMerchandiseKits();

            const kits = await prisma.merchandiseKit.findMany({
                orderBy: { created_at: 'desc' }
            });
            res.json(successResponse(kits, 'Merchandise products retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createMerchandiseKit = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, description, price, image_url, badge, items_included, is_available } = req.body;
            if (!name || price === undefined) {
                throw new BadRequestError('Product name and price are required');
            }

            const kit = await prisma.merchandiseKit.create({
                data: {
                    name,
                    description: description || name,
                    price: parseFloat(price),
                    image_url: image_url || null,
                    badge: badge || null,
                    items_included: Array.isArray(items_included) ? items_included : (items_included ? [items_included] : []),
                    is_available: is_available !== undefined ? Boolean(is_available) : true,
                }
            });
            res.status(201).json(successResponse(kit, 'Product created successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateMerchandiseKit = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { name, description, price, image_url, badge, items_included, is_available } = req.body;

            const updateData: any = {};
            if (name !== undefined) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (price !== undefined) updateData.price = parseFloat(price);
            if (image_url !== undefined) updateData.image_url = image_url;
            if (badge !== undefined) updateData.badge = badge;
            if (items_included !== undefined) {
                updateData.items_included = Array.isArray(items_included) ? items_included : [items_included];
            }
            if (is_available !== undefined) updateData.is_available = Boolean(is_available);

            const updated = await prisma.merchandiseKit.update({
                where: { id },
                data: updateData
            });
            res.json(successResponse(updated, 'Product updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteMerchandiseKit = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await prisma.merchandiseKit.delete({
                where: { id }
            });
            res.json(successResponse({ id }, 'Product deleted successfully'));
        } catch (error) {
            next(error);
        }
    };

    getMerchandiseOrders = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const orders = await prisma.merchandiseOrder.findMany({
                include: {
                    partner: {
                        include: {
                            user: { select: { full_name: true, phone_number: true, email: true } }
                        }
                    },
                    kit: true
                },
                orderBy: { created_at: 'desc' }
            });
            res.json(successResponse(orders, 'Merchandise orders retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateMerchandiseOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            if (!status) throw new BadRequestError('Status is required');

            const updatedOrder = await prisma.merchandiseOrder.update({
                where: { id },
                data: { status }
            });
            res.json(successResponse(updatedOrder, 'Order status updated successfully'));
        } catch (error) {
            next(error);
        }
    };
}

export const adminManagementController = new AdminManagementController();
