import { Router } from 'express';
import ticketController from '../controllers/ticket.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Live resolution report stats
router.get('/stats', ticketController.getTicketStats);

// List tickets with filters
router.get('/', ticketController.getAllTickets);

// Single ticket details
router.get('/:id', ticketController.getTicketById);

// Create ticket (Users or Admins)
router.post('/', ticketController.createTicket);

// Update ticket status or resolution (Admins)
router.patch(
    '/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    ticketController.updateTicket
);

// Delete ticket (Admins)
router.delete(
    '/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    ticketController.deleteTicket
);

export default router;
