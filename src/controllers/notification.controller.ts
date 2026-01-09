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
}
