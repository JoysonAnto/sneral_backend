import { Request, Response, NextFunction } from 'express';
import { LocationTrackingService } from '../services/location-tracking.service';
import { successResponse } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import prisma from '../config/database';

export class LocationTrackingController {
    private locationService: LocationTrackingService;

    constructor() {
        this.locationService = new LocationTrackingService();
    }

    // Partner updates their location (auto-called when online)
    updateLocation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { latitude, longitude, accuracy, bookingId } = req.body;

            const location = await this.locationService.recordPartnerLocation(
                partner.id,
                latitude,
                longitude,
                accuracy,
                bookingId
            );

            res.json(successResponse(location, 'Location updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    // Get partner's own location history
    getMyLocationHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { startDate, endDate, limit } = req.query;

            const history = await this.locationService.getPartnerLocationHistory(
                partner.id,
                startDate ? new Date(startDate as string) : undefined,
                endDate ? new Date(endDate as string) : undefined,
                limit ? parseInt(limit as string) : 100
            );

            res.json(successResponse(history, 'Location history retrieved'));
        } catch (error) {
            next(error);
        }
    };

    // Admin: Get all online partners with locations
    getAllOnlinePartners = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const partners = await this.locationService.getAllOnlinePartners();
            res.json(successResponse(partners, 'Online partners retrieved'));
        } catch (error) {
            next(error);
        }
    };

    // Admin: Get location history for specific partner
    getPartnerLocationHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { partnerId } = req.params;
            const { startDate, endDate, limit } = req.query;

            const history = await this.locationService.getPartnerLocationHistory(
                partnerId,
                startDate ? new Date(startDate as string) : undefined,
                endDate ? new Date(endDate as string) : undefined,
                limit ? parseInt(limit as string) : 100
            );

            res.json(successResponse(history, 'Partner location history retrieved'));
        } catch (error) {
            next(error);
        }
    };

    // Admin: Get location history for a booking
    getBookingLocationHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { bookingId } = req.params;
            const history = await this.locationService.getBookingLocationHistory(bookingId);
            res.json(successResponse(history, 'Booking location history retrieved'));
        } catch (error) {
            next(error);
        }
    };

    // Admin: Get activity logs for a booking
    getBookingActivityLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { bookingId } = req.params;
            const logs = await this.locationService.getBookingActivityLogs(bookingId);
            res.json(successResponse(logs, 'Activity logs retrieved'));
        } catch (error) {
            next(error);
        }
    };

    // Admin: Get all activity logs with filters
    getAllActivityLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate, actorType, action, limit, page } = req.query;

            const result = await this.locationService.getAllActivityLogs({
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                actorType: actorType as string,
                action: action as string,
                limit: limit ? parseInt(limit as string) : 50,
                page: page ? parseInt(page as string) : 1,
            });

            res.json(successResponse(result.logs, 'Activity logs retrieved', result.pagination));
        } catch (error) {
            next(error);
        }
    };

    /**
     * Customer: Get current location of assigned partner for a booking
     */
    getCustomerBookingTracking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { bookingId } = req.params;
            const userId = req.user!.userId;

            // Fetch booking with partner details
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    partner: {
                        include: {
                            user: {
                                select: {
                                    full_name: true,
                                    phone_number: true,
                                }
                            }
                        }
                    }
                }
            });

            if (!booking) {
                throw new BadRequestError('Booking not found');
            }

            // Verify booking belongs to customer
            if (booking.customer_id !== userId) {
                throw new UnauthorizedError('Unauthorized to track this booking');
            }

            if (!booking.partner_id || !booking.partner) {
                return res.json(successResponse({
                    status: booking.status,
                    partner: null,
                    location: null
                }, 'Partner not yet assigned'));
            }

            // Return partner's current location and tracking info
            const trackingInfo = {
                status: booking.status,
                partner: {
                    name: booking.partner.user.full_name,
                    phone: booking.partner.user.phone_number,
                    availability: booking.partner.availability_status,
                },
                location: {
                    latitude: booking.partner.current_latitude,
                    longitude: booking.partner.current_longitude,
                    lastUpdate: booking.partner.last_location_update,
                }
            };

            return res.json(successResponse(trackingInfo, 'Tracking info retrieved'));
        } catch (error) {
            return next(error);
        }
    };
}
