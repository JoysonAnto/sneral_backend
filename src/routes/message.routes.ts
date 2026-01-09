import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const messageController = new MessageController();

// All routes require authentication
router.use(authenticateToken);

// Get all conversations
router.get('/conversations', messageController.getConversations);

// Get conversation messages
router.get('/conversations/:id', messageController.getConversationMessages);

// Send message
router.post(
    '/conversations/:id/messages',
    validate([
        body('message')
            .trim()
            .notEmpty()
            .withMessage('Message cannot be empty')
            .isLength({ max: 1000 })
            .withMessage('Message too long'),
        body('bookingId')
            .optional()
            .isUUID()
            .withMessage('Invalid booking ID'),
    ]),
    messageController.sendMessage
);

export default router;
