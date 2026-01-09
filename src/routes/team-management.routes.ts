import { Router } from 'express';
import { teamManagementController } from '../controllers/team-management.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and BUSINESS_PARTNER role
router.use(authenticateToken);
router.use(authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'));

// Toggle team management feature
router.post(
    '/business/:businessPartnerId/team/toggle',
    teamManagementController.toggleTeamManagement.bind(teamManagementController)
);

// Get team members list
router.get(
    '/business/:businessPartnerId/team',
    teamManagementController.getTeamMembers.bind(teamManagementController)
);

// Get team statistics
router.get(
    '/business/:businessPartnerId/team/stats',
    teamManagementController.getTeamStats.bind(teamManagementController)
);

// Invite partner to team
router.post(
    '/business/:businessPartnerId/team/invite',
    teamManagementController.invitePartner.bind(teamManagementController)
);

// Get team member details
router.get(
    '/team/:id',
    teamManagementController.getTeamMember.bind(teamManagementController)
);

// Update team member
router.patch(
    '/team/:id',
    teamManagementController.updateTeamMember.bind(teamManagementController)
);

// Remove team member
router.delete(
    '/team/:id',
    teamManagementController.removeTeamMember.bind(teamManagementController)
);

// Accept invitation (for service partners)
router.post(
    '/team/:id/accept',
    teamManagementController.acceptInvitation.bind(teamManagementController)
);

export default router;
