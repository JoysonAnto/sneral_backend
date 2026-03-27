import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    exportUserData,
    requestDataDeletion,
    updateConsent,
    getConsent,
    downloadUserData,
} from '../controllers/compliance.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * tags:
 *   name: Compliance & Privacy
 *   description: GDPR data management and user consent
 */

/**
 * @swagger
 * /compliance/export:
 *   get:
 *     summary: Export all user data (GDPR Right to Access)
 *     tags: [Compliance & Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data export initiated
 */
router.get('/export', exportUserData);

/**
 * @swagger
 * /compliance/download:
 *   get:
 *     summary: Download exported data as JSON (GDPR Data Portability)
 *     tags: [Compliance & Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: JSON data stream
 */
router.get('/download', downloadUserData);

/**
 * @swagger
 * /compliance/delete-account:
 *   post:
 *     summary: Request permanent account deletion (GDPR Right to Erasure)
 *     tags: [Compliance & Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion request recorded
 */
router.post('/delete-account', requestDataDeletion);

/**
 * @swagger
 * /compliance/consent:
 *   get:
 *     summary: View current data collection consent preferences
 *     tags: [Compliance & Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consent settings retrieved
 */
router.get('/consent', getConsent);

/**
 * @swagger
 * /compliance/consent:
 *   put:
 *     summary: Update data collection consent preferences
 *     tags: [Compliance & Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put('/consent', updateConsent);

export default router;
