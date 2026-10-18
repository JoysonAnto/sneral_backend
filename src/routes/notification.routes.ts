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
<<<<<<< HEAD
 *     summary: Fetch system alerts and job updates (paginated)
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: string, enum: ['true', 'false'] }
=======
 *     summary: Fetch unread system alerts and job updates
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
>>>>>>> ab6c12b (feat: add Swagger API documentation for Partner APIs)
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/', notificationController.getNotifications);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
<<<<<<< HEAD
 *     summary: Dismiss a single notification
=======
 *     summary: Dismiss a notification
>>>>>>> ab6c12b (feat: add Swagger API documentation for Partner APIs)
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
<<<<<<< HEAD
 *         schema: { type: string }
=======
 *         schema:
 *           type: string
>>>>>>> ab6c12b (feat: add Swagger API documentation for Partner APIs)
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
router.post('/mark-all-read', notificationController.markAllAsRead);

// Delete a specific notification
router.delete('/:id', notificationController.deleteNotification);

// ─────────────────────────────────────────────────────────────────────────────
// FCM Device Token Management
// Mobile apps should call POST /register-device immediately after login and
// DELETE /unregister-device on logout.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /notifications/register-device:
 *   post:
 *     summary: Register or refresh FCM device token for push notifications
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 description: Firebase Cloud Messaging device token from the mobile app
 *     responses:
 *       200:
 *         description: Device token registered
 *       400:
 *         description: fcmToken is required
 */
router.post('/register-device', notificationController.registerDevice);

/**
 * @swagger
 * /notifications/unregister-device:
 *   delete:
 *     summary: Remove FCM device token (call on logout)
 *     tags: [Real-time Tracking & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device token removed
 */
router.delete('/unregister-device', notificationController.unregisterDevice);

export default router;

