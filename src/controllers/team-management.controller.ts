import { Request, Response } from 'express';
import { TeamManagementService } from '../services/team-management.service';

const teamService = new TeamManagementService();

export class TeamManagementController {
    // Toggle team management feature
    async toggleTeamManagement(req: Request, res: Response) {
        try {
            const { businessPartnerId } = req.params;
            const { enabled } = req.body;

            const result = await teamService.toggleTeamManagement(businessPartnerId, enabled);

            return res.status(200).json({
                success: true,
                message: `Team management ${enabled ? 'enabled' : 'disabled'} successfully`,
                data: result,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to toggle team management',
            });
        }
    }

    // Get team members list
    async getTeamMembers(req: Request, res: Response) {
        try {
            const { businessPartnerId } = req.params;
            const { status, role, search, limit, offset } = req.query;

            // Check if enabled
            const enabled = await teamService.isTeamManagementEnabled(businessPartnerId);
            if (!enabled) {
                return res.status(403).json({
                    success: false,
                    message: 'Team management is not enabled',
                });
            }

            const filters = {
                status: status as string,
                role: role as string,
                search: search as string,
                limit: limit ? parseInt(limit as string) : undefined,
                offset: offset ? parseInt(offset as string) : undefined,
            };

            const result = await teamService.getTeamMembers(businessPartnerId, filters);

            return res.status(200).json({
                success: true,
                data: result.associations,
                pagination: result.pagination,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch team members',
            });
        }
    }

    // Get team member details
    async getTeamMember(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const association = await teamService.getTeamMember(id);

            res.status(200).json({
                success: true,
                data: association,
            });
        } catch (error: any) {
            res.status(404).json({
                success: false,
                message: error.message || 'Team member not found',
            });
        }
    }

    // Invite partner to team
    async invitePartner(req: Request, res: Response) {
        try {
            const { businessPartnerId } = req.params;
            const data = req.body;

            const association = await teamService.invitePartner(businessPartnerId, data);

            res.status(201).json({
                success: true,
                message: 'Invitation sent successfully',
                data: association,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to invite partner',
            });
        }
    }

    // Accept invitation (for service partners)
    async acceptInvitation(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { servicePartnerId } = req.body;

            const association = await teamService.acceptInvitation(id, servicePartnerId);

            res.status(200).json({
                success: true,
                message: 'Invitation accepted successfully',
                data: association,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to accept invitation',
            });
        }
    }

    // Update team member
    async updateTeamMember(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const data = req.body;

            const association = await teamService.updateTeamMember(id, data);

            res.status(200).json({
                success: true,
                message: 'Team member updated successfully',
                data: association,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to update team member',
            });
        }
    }

    // Remove team member
    async removeTeamMember(req: Request, res: Response) {
        try {
            const { id } = req.params;

            await teamService.removeTeamMember(id);

            res.status(200).json({
                success: true,
                message: 'Team member removed successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to remove team member',
            });
        }
    }

    // Get team statistics
    async getTeamStats(req: Request, res: Response) {
        try {
            const { businessPartnerId } = req.params;

            const stats = await teamService.getTeamStats(businessPartnerId);

            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch team statistics',
            });
        }
    }
}

export const teamManagementController = new TeamManagementController();
