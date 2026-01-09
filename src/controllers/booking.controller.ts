import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service';
import { successResponse } from '../utils/response';

export class BookingController {
    private bookingService: BookingService;

    constructor() {
        this.bookingService = new BookingService();
    }

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.createBooking(
                req.user!.userId,
                req.body
            );
            res.status(201).json(successResponse(booking, 'Booking created successfully'));
        } catch (error) {
            next(error);
        }
    };

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.bookingService.getAllBookings(
                req.query,
                req.user!.userId,
                req.user!.role
            );
            res.json(
                successResponse(
                    result.bookings,
                    'Bookings retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.getBookingById(
                req.params.id,
                req.user!.userId,
                req.user!.role
            );
            res.json(successResponse(booking, 'Booking retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.updateBookingStatus(
                req.params.id,
                req.body.status,
                req.user!.userId,
                req.body.notes
            );
            res.json(successResponse(booking, 'Booking status updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    assignPartner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.assignPartner(
                req.params.id,
                req.body.partnerId,
                req.user!.userId
            );
            res.json(successResponse(booking, 'Partner assigned successfully'));
        } catch (error) {
            next(error);
        }
    };

    acceptBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const booking = await this.bookingService.acceptBooking(
                req.params.id,
                partner.id
            );
            res.json(successResponse(booking, 'Booking accepted successfully'));
        } catch (error) {
            next(error);
        }
    };

    startBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const booking = await this.bookingService.startBooking(
                req.params.id,
                partner.id
            );
            res.json(successResponse(booking, 'Booking started successfully'));
        } catch (error) {
            next(error);
        }
    };

    completeBooking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const booking = await this.bookingService.completeBooking(
                req.params.id,
                partner.id
            );
            res.json(successResponse(booking, 'Booking completed successfully'));
        } catch (error) {
            next(error);
        }
    };

    cancel = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const booking = await this.bookingService.cancelBooking(
                req.params.id,
                req.user!.userId,
                req.body.reason
            );
            res.json(successResponse(booking, 'Booking cancelled successfully'));
        } catch (error) {
            next(error);
        }
    };

    rate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.bookingService.rateBooking(
                req.params.id,
                req.user!.userId,
                req.body.rating,
                req.body.review
            );
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };
}
