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
            console.log(`🔍 [BOOKING DEBUG] getAll called by user: ${req.user?.userId}, role: ${req.user?.role}`);
            const result = await this.bookingService.getAllBookings(
                req.query,
                req.user!.userId,
                req.user!.role
            );
            console.log(`🔍 [BOOKING DEBUG] Found ${result.bookings.length} bookings`);
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
            console.log(`🔍 [ACCEPT DEBUG] Partner ${req.user?.userId} attempting to accept booking ${req.params.id}`);
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                console.log(`❌ [ACCEPT DEBUG] Partner profile not found for user ${req.user?.userId}`);
                throw new Error('Service partner profile not found');
            }

            console.log(`🔍 [ACCEPT DEBUG] Found partner ${partner.id}. Calling service...`);
            const booking = await this.bookingService.acceptBooking(
                req.params.id,
                partner.id
            );
            console.log(`✅ [ACCEPT DEBUG] Successfully accepted booking ${req.params.id}`);
            res.json(successResponse(booking, 'Booking accepted successfully'));
        } catch (error: any) {
            console.error(`❌ [ACCEPT DEBUG] Error:`, error);
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
                partner.id,
                req.body.otp
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
            res.json(successResponse(result, 'Rating submitted successfully'));
        } catch (error) {
            next(error);
        }
    };

    // New methods for service progress and completion
    arriveAtLocation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { latitude, longitude } = req.body;
            const booking = await this.bookingService.arriveAtLocation(
                req.params.id,
                partner.id,
                latitude,
                longitude
            );
            res.json(successResponse(booking, 'Arrival confirmed successfully'));
        } catch (error) {
            next(error);
        }
    };

    uploadBeforePhotos = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                throw new Error('No images uploaded');
            }

            const imageUrls = files.map(file => `/uploads/service-photos/${file.filename}`);
            const result = await this.bookingService.uploadBeforeServicePhotos(
                req.params.id,
                partner.id,
                imageUrls
            );
            res.json(successResponse(result, 'Before-service photos uploaded successfully'));
        } catch (error) {
            next(error);
        }
    };

    uploadAfterPhotos = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                throw new Error('No images uploaded');
            }

            const imageUrls = files.map(file => `/uploads/service-photos/${file.filename}`);
            const result = await this.bookingService.uploadAfterServicePhotos(
                req.params.id,
                partner.id,
                imageUrls
            );
            res.json(successResponse(result, 'After-service photos uploaded successfully'));
        } catch (error) {
            next(error);
        }
    };

    generateStartOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const otp = await this.bookingService.generateStartOTP(req.params.id);
            res.json(successResponse({ otp }, 'Start OTP generated successfully'));
        } catch (error) {
            next(error);
        }
    };

    generateCompletionOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const otp = await this.bookingService.generateCompletionOTP(req.params.id);
            res.json(successResponse({ otp }, 'OTP generated successfully'));
        } catch (error) {
            next(error);
        }
    };

    verifyCompletionOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { otp, serviceNotes } = req.body;
            const result = await this.bookingService.verifyCompletionOTP(
                req.params.id,
                partner.id,
                otp,
                serviceNotes
            );
            res.json(successResponse(result, 'Service completed successfully'));
        } catch (error) {
            next(error);
        }
    };

    updatePartnerLocation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const partner = await import('../config/database').then(m =>
                m.default.servicePartner.findUnique({
                    where: { user_id: req.user!.userId }
                })
            );

            if (!partner) {
                throw new Error('Service partner profile not found');
            }

            const { latitude, longitude } = req.body;
            const result = await this.bookingService.updatePartnerLocation(
                partner.id,
                latitude,
                longitude
            );
            res.json(successResponse(result, 'Location updated successfully'));
        } catch (error) {
            next(error);
        }
    };
}
