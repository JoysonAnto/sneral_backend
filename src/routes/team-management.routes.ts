import { Router } from 'express';
import { teamManagementController } from '../controllers/team-management.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and BUSINESS_PARTNER role
router.use(authenticateToken);
// Toggle team management feature
router.post(
    '/business/:businessPartnerId/team/toggle',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    teamManagementController.toggleTeamManagement.bind(teamManagementController)
);

// Get team members list
router.get(
    '/business/:businessPartnerId/team',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    teamManagementController.getTeamMembers.bind(teamManagementController)
);

// Get team statistics
router.get(
    '/business/:businessPartnerId/team/stats',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    teamManagementController.getTeamStats.bind(teamManagementController)
);

// Invite partner to team
router.post(
    '/business/:businessPartnerId/team/invite',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    teamManagementController.invitePartner.bind(teamManagementController)
);

// Get team member details
router.get(
    '/team/:id',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    teamManagementController.getTeamMember.bind(teamManagementController)
);

// Update team member
router.patch(
    '/team/:id',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    teamManagementController.updateTeamMember.bind(teamManagementController)
);

// Remove team member
router.delete(
    '/team/:id',
    authorize('BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
    teamManagementController.removeTeamMember.bind(teamManagementController)
);

// Accept invitation (for service partners)
router.post(
    '/team/:id/accept',
    authorize('SERVICE_PARTNER'), // Now correctly allowed!
    teamManagementController.acceptInvitation.bind(teamManagementController)
);

export default router;
