import { Router } from 'express';
import { supportChatController } from '../controllers/support-chat.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();

// All support chat endpoints require an authenticated user
router.use(authenticateToken);

// Customer & Partner Support Chat
router.get('/thread', supportChatController.getThreadInfo);
router.get('/messages', supportChatController.getMessages);
router.post('/messages', supportChatController.sendMessage);

// Admin Support Desk Management
router.get('/admin/threads', authorize('ADMIN', 'SUPER_ADMIN'), supportChatController.getAdminThreads);

export default router;
