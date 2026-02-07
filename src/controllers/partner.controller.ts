import { Request, Response, NextFunction } from 'express';
import { PartnerService } from '../services/partner.service';
import { successResponse } from '../utils/response';

export class PartnerController {
    private partnerService: PartnerService;

    constructor() {
        this.partnerService = new PartnerService();
    }

    getAllPartners = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.partnerService.getAllPartners(
                req.query,
                req.user!.role
            );
            res.json(
                successResponse(
                    result.partners,
                    'Partners retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getPartnerById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await this.partnerService.getPartnerById(
                req.params.id,
                req.user!.userId,
                req.user!.role
            );
            res.json(successResponse(partner, 'Partner details retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    createServicePartner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await this.partnerService.createServicePartner(
                req.body,
                req.user!.userId,
                req.user!.role
            );
            res.status(201).json(successResponse(partner, (partner as any).message || 'Partner created successfully'));
        } catch (error) {
            return next(error);
        }
    };

    updatePartner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await this.partnerService.updatePartner(
                req.params.id,
                req.body,
                req.user!.userId,
                req.user!.role
            );
            res.json(successResponse(partner, 'Partner updated successfully'));
        } catch (error) {
            return next(error);
        }
    };

    updateAvailability = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Get partner ID from user
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const result = await this.partnerService.updateAvailability(
                partner.id,
                req.body
            );
            res.json(successResponse(result, 'Availability updated successfully'));
        } catch (error) {
            return next(error);
        }
    };

    getPartnerServices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const services = await this.partnerService.getPartnerServices(req.params.id);
            res.json(successResponse(services, 'Partner services retrieved successfully'));
        } catch (error) {
            return next(error);
        }
    };

    updatePartnerService = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const service = await this.partnerService.updatePartnerService(
                req.params.id,
                req.body
            );
            res.json(successResponse(service, 'Service updated successfully'));
        } catch (error) {
            return next(error);
        }
    };

    getPartnerEarnings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const earnings = await this.partnerService.getPartnerEarnings(req.params.id);
            res.json(successResponse(earnings, 'Earnings retrieved successfully'));
        } catch (error) {
            return next(error);
        }
    };

    // Get bookings for a specific partner
    getPartnerBookings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Import BookingService to reuse the filtering logic
            const { BookingService } = await import('../services/booking.service');
            const bookingService = new BookingService();

            const result = await bookingService.getAllBookings(
                { ...req.query, partnerId: req.params.id },
                req.user!.userId,
                req.user!.role
            );

            res.json(
                successResponse(
                    result.bookings,
                    'Partner bookings retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            return next(error);
        }
    };

    // ================
    // ENHANCEMENTS
    // ================

    // Performance Analytics
    getPartnerPerformance = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate } = req.query;
            const dateRange = startDate && endDate
                ? { start: new Date(startDate as string), end: new Date(endDate as string) }
                : undefined;

            const performance = await this.partnerService.getPartnerPerformance(
                req.params.id,
                dateRange
            );
            res.json(successResponse(performance, 'Performance metrics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Team Management (Business Partners)
    addTeamMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.partnerService.addTeamMember(
                req.params.id,
                req.body.servicePartnerId,
                req.user!.userId
            );
            res.status(201).json(successResponse(result, (result as any).message || 'Operation successful'));
        } catch (error) {
            next(error);
        }
    };

    removeTeamMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.partnerService.removeTeamMember(
                req.params.id,
                req.params.memberId,
                req.user!.userId
            );
            res.json(successResponse(result, (result as any).message || 'Operation successful'));
        } catch (error) {
            next(error);
        }
    };

    getTeamMembers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const members = await this.partnerService.getTeamMembers(req.params.id);
            res.json(successResponse(members, 'Team members retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getTeamPerformance = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const performance = await this.partnerService.getTeamPerformance(req.params.id);
            res.json(successResponse(performance, 'Team performance retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Service Assignment
    assignServiceToPartner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.partnerService.assignServiceToPartner(
                req.params.id,
                req.body.serviceId,
                req.body.options
            );
            res.status(201).json(successResponse(result, (result as any).message || 'Operation successful'));
        } catch (error) {
            next(error);
        }
    };

    // Commission Management
    updateCommissionRate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.partnerService.updateCommissionRate(
                req.params.id,
                req.body.rate,
                req.user!.userId
            );
            res.json(successResponse(result, (result as any).message || 'Operation successful'));
        } catch (error) {
            next(error);
        }
    };

    getCommissionHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const history = await this.partnerService.getCommissionHistory(req.params.id);
            res.json(successResponse(history, 'Commission history retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Bulk Operations
    bulkAssignServices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.partnerService.bulkAssignServices(
                req.body.partnerIds,
                req.body.serviceIds
            );
            res.json(successResponse(result, (result as any).message || 'Operation successful'));
        } catch (error) {
            next(error);
        }
    };

    // ================
    // PHASE 2: ANALYTICS
    // ================

    // Partners Analytics Aggregation
    getPartnersAnalytics = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate, type } = req.query;
            const filters = {
                ...(startDate && { startDate: new Date(startDate as string) }),
                ...(endDate && { endDate: new Date(endDate as string) }),
                ...(type && { type: type as string }),
            };

            const analytics = await this.partnerService.getPartnersAnalytics(filters);
            res.json(successResponse(analytics, 'Analytics retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Top Performers
    getTopPerformers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { sortBy, limit, type } = req.query;
            const params = {
                sortBy: sortBy as string,
                limit: limit ? parseInt(limit as string) : undefined,
                type: type as string,
            };

            const performers = await this.partnerService.getTopPerformers(params);
            res.json(successResponse(performers, 'Top performers retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Commission Report
    getCommissionReport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate } = req.query;
            const dateRange =
                startDate && endDate
                    ? { start: new Date(startDate as string), end: new Date(endDate as string) }
                    : undefined;

            const report = await this.partnerService.getCommissionReport(dateRange);
            res.json(successResponse(report, 'Commission report retrieved successfully'));
        } catch (error) {
            return next(error);
        }
    };

    // Analytics Trends
    getAnalyticsTrends = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { partnerId, metric, startDate, endDate, period } = req.query;

            if (!partnerId || !metric || !startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameters: partnerId, metric, startDate, endDate',
                });
            }

            const dateRange = {
                start: new Date(startDate as string),
                end: new Date(endDate as string),
            };

            const trends = await this.partnerService.getAnalyticsTrends(
                partnerId as string,
                metric as 'bookings' | 'revenue' | 'rating',
                dateRange,
                (period as 'daily' | 'weekly' | 'monthly') || 'weekly'
            );

            return res.json(successResponse(trends, 'Trends retrieved successfully'));
        } catch (error) {
            return next(error);
        }
    };
    // ================
    // BOOKING ACTIONS (Service Partner)
    // ================

    /**
     * Accept a booking (Ola-like flow - first come first served)
     */
    acceptBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.partnerService.acceptBookingByPartner(
                req.params.bookingId,
                req.user!.userId
            );
            res.json(successResponse(booking, 'Booking accepted successfully'));
        } catch (error) {
            return next(error);
        }
    };

    /**
     * Reject a booking
     */
    rejectBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { reason } = req.body;
            await this.partnerService.rejectBookingByPartner(
                req.params.bookingId,
                req.user!.userId,
                reason
            );
            res.json(successResponse(null, 'Booking rejected successfully'));
        } catch (error) {
            return next(error);
        }
    };
}

