
import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';
import { chatUpload } from '../middleware/upload.middleware';

const router = Router();
const messageController = new MessageController();

// All routes require authentication
router.use(authenticateToken);

// Get all conversations
router.get('/conversations', messageController.getConversations);

// --- NEW SPEC ROUTES ---

// [GET] /api/v1/messages/conversations/:id
// Fetch history for a specific conversation (booking based)
router.get('/conversations/:id', messageController.getConversationHistory);

// [POST] /api/v1/messages/conversations/:id/messages
// Send a new message following the mobile app spec
router.post(
    '/conversations/:id/messages',
    validate([
        body('text').trim().notEmpty().withMessage('Message text is required'),
        body('bookingId').notEmpty().withMessage('Booking ID is required')
    ]),
    messageController.sendSpecMessage
);

// [POST] /api/v1/messages/upload
// Upload file attachment
router.post(
    '/upload',
    chatUpload.single('file'),
    messageController.uploadAttachment
);

// --- LEGACY ROUTES (KEEPING FOR COMPATIBILITY) ---
router.post(
    '/send/:id',
    validate([
        body('message').trim().notEmpty(),
    ]),
    messageController.sendMessage
);

export default router;
