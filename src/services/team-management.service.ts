import prisma from '../config/database';
import { TeamMemberRole, TeamMemberStatus } from '@prisma/client';

interface CreateAssociationData {
    service_partner_id: string;
    role?: TeamMemberRole;
    commission_split?: number;
    notes?: string;
    invitation_message?: string;
}

interface UpdateAssociationData {
    role?: TeamMemberRole;
    status?: TeamMemberStatus;
    commission_split?: number;
    notes?: string;
}

export class TeamManagementService {
    // Check if team management is enabled for business partner
    async isTeamManagementEnabled(businessPartnerId: string): Promise<boolean> {
        const businessPartner = await prisma.businessPartner.findUnique({
            where: { id: businessPartnerId },
            select: { team_management_enabled: true },
        });

        return businessPartner?.team_management_enabled || false;
    }

    // Enable/disable team management
    async toggleTeamManagement(businessPartnerId: string, enabled: boolean) {
        return await prisma.businessPartner.update({
            where: { id: businessPartnerId },
            data: { team_management_enabled: enabled },
        });
    }

    // Get all team members
    async getTeamMembers(businessPartnerId: string, filters?: any) {
        const { status, role, search, limit = 50, offset = 0 } = filters || {};

        const where: any = {
            business_partner_id: businessPartnerId,
        };

        if (status) {
            where.status = status;
        }

        if (role) {
            where.role = role;
        }

        if (search) {
            where.service_partner = {
                user: {
                    OR: [
                        { full_name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { phone_number: { contains: search } },
                    ],
                },
            };
        }

        const [associations, totalCount] = await Promise.all([
            prisma.partnerAssociation.findMany({
                where,
                include: {
                    service_partner: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    full_name: true,
                                    email: true,
                                    phone_number: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip: offset,
                take: limit,
            }),
            prisma.partnerAssociation.count({ where }),
        ]);

        return {
            associations,
            pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: offset + limit < totalCount,
            },
        };
    }

    // Get team member by ID
    async getTeamMember(associationId: string) {
        const association = await prisma.partnerAssociation.findUnique({
            where: { id: associationId },
            include: {
                service_partner: {
                    include: {
                        user: true,
                        bookings: {
                            where: { status: 'COMPLETED' },
                            select: {
                                id: true,
                                total_amount: true,
                                created_at: true,
                            },
                        },
                    },
                },
                business_partner: {
                    select: {
                        id: true,
                        business_name: true,
                    },
                },
            },
        });

        if (!association) {
            throw new Error('Team member not found');
        }

        return association;
    }

    // Invite partner to team
    async invitePartner(businessPartnerId: string, data: CreateAssociationData) {
        // Check if team management is enabled
        const enabled = await this.isTeamManagementEnabled(businessPartnerId);
        if (!enabled) {
            throw new Error('Team management is not enabled for this business partner');
        }

        // Check if partner exists
        const servicePartner = await prisma.servicePartner.findUnique({
            where: { id: data.service_partner_id },
        });

        if (!servicePartner) {
            throw new Error('Service partner not found');
        }

        // Check if already associated
        const existing = await prisma.partnerAssociation.findUnique({
            where: {
                business_partner_id_service_partner_id: {
                    business_partner_id: businessPartnerId,
                    service_partner_id: data.service_partner_id,
                },
            },
        });

        if (existing) {
            throw new Error('Partner is already part of your team');
        }

        // Create association
        return await prisma.partnerAssociation.create({
            data: {
                business_partner_id: businessPartnerId,
                service_partner_id: data.service_partner_id,
                role: data.role || 'MEMBER',
                commission_split: data.commission_split || 0,
                notes: data.notes,
                invitation_message: data.invitation_message,
                status: 'PENDING',
            },
            include: {
                service_partner: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    }

    // Accept invitation (called by service partner)
    async acceptInvitation(associationId: string, servicePartnerId: string) {
        const association = await prisma.partnerAssociation.findUnique({
            where: { id: associationId },
        });

        if (!association) {
            throw new Error('Invitation not found');
        }

        if (association.service_partner_id !== servicePartnerId) {
            throw new Error('Unauthorized');
        }

        if (association.status !== 'PENDING') {
            throw new Error('Invitation has already been processed');
        }

        return await prisma.partnerAssociation.update({
            where: { id: associationId },
            data: {
                status: 'ACTIVE',
                joined_at: new Date(),
            },
            include: {
                service_partner: {
                    include: {
                        user: true,
                    },
                },
                business_partner: {
                    select: {
                        business_name: true,
                    },
                },
            },
        });
    }

    // Update team member
    async updateTeamMember(associationId: string, data: UpdateAssociationData) {
        return await prisma.partnerAssociation.update({
            where: { id: associationId },
            data,
            include: {
                service_partner: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    }

    // Remove team member
    async removeTeamMember(associationId: string) {
        const association = await prisma.partnerAssociation.findUnique({
            where: { id: associationId },
        });

        if (!association) {
            throw new Error('Team member not found');
        }

        // Update status to LEFT instead of deleting
        return await prisma.partnerAssociation.update({
            where: { id: associationId },
            data: {
                status: 'LEFT',
                left_at: new Date(),
            },
        });
    }

    // Get team statistics
    async getTeamStats(businessPartnerId: string) {
        const [active, pending, inactive, total] = await Promise.all([
            prisma.partnerAssociation.count({
                where: { business_partner_id: businessPartnerId, status: 'ACTIVE' },
            }),
            prisma.partnerAssociation.count({
                where: { business_partner_id: businessPartnerId, status: 'PENDING' },
            }),
            prisma.partnerAssociation.count({
                where: { business_partner_id: businessPartnerId, status: 'INACTIVE' },
            }),
            prisma.partnerAssociation.count({
                where: { business_partner_id: businessPartnerId },
            }),
        ]);

        return {
            total,
            active,
            pending,
            inactive,
            left: total - active - pending - inactive,
        };
    }
}
