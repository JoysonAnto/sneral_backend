import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Fetch unread system alerts and job updates
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/', notificationController.getNotifications);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Dismiss a notification
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
router.post('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

export default router;
