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
 * @route   GET /api/v1/compliance/export
 * @desc    Export user data (GDPR Right to Access)
 * @access  Private
 */
router.get('/export', exportUserData);

/**
 * @route   GET /api/v1/compliance/download
 * @desc    Download user data as JSON file (GDPR Data Portability)
 * @access  Private
 */
router.get('/download', downloadUserData);

/**
 * @route   POST /api/v1/compliance/delete-account
 * @desc    Request account deletion (GDPR Right to Erasure)
 * @access  Private
 */
router.post('/delete-account', requestDataDeletion);

/**
 * @route   GET /api/v1/compliance/consent
 * @desc    Get user consent preferences
 * @access  Private
 */
router.get('/consent', getConsent);

/**
 * @route   PUT /api/v1/compliance/consent
 * @desc    Update consent preferences
 * @access  Private
 */
router.put('/consent', updateConsent);

export default router;
