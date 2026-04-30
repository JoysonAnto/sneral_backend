import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { successResponse } from '../utils/response';

export class NotificationController {
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService();
    }

    getNotifications = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.notificationService.getNotifications(
                req.user!.userId,
                req.query
            );
            res.json(
                successResponse(
                    {
                        notifications: result.notifications,
                        unreadCount: result.unreadCount,
                    },
                    'Notifications retrieved successfully',
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    };

    markAsRead = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.notificationService.markAsRead(
                req.params.id,
                req.user!.userId
            );
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.notificationService.markAllAsRead(req.user!.userId);
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.notificationService.deleteNotification(
                req.params.id,
                req.user!.userId
            );
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /notifications/register-device
     * Body: { fcmToken: string }
     * Called by mobile app after login to enable push notifications.
     */
    registerDevice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { fcmToken } = req.body;
            if (!fcmToken || typeof fcmToken !== 'string') {
                res.status(400).json({ success: false, message: 'fcmToken is required' });
                return;
            }
            const result = await this.notificationService.updateFcmToken(req.user!.userId, fcmToken);
            res.json(successResponse(null, result.message));
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /notifications/unregister-device
     * Called by mobile app on logout to stop push notifications.
     */
    unregisterDevice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.notificationService.removeFcmToken(req.user!.userId);
            res.json(successResponse(null, result.message));
        } catch (error) {
            next(error);
        }
    };
}
