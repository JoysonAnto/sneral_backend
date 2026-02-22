import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

export class RoleService {
    async getAllRoles() {
        return prisma.role.findMany({
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    async getRoleById(roleId: string) {
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role;
    }

    async createRole(data: { name: string, description?: string, permissionIds?: string[] }) {
        const existingRole = await prisma.role.findUnique({
            where: { name: data.name }
        });

        if (existingRole) {
            throw new BadRequestError('Role name already exists');
        }

        const role = await prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                permissions: {
                    create: data.permissionIds?.map(id => ({
                        permission_id: id
                    }))
                }
            },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        return role;
    }

    async updateRole(roleId: string, data: { name?: string, description?: string, permissionIds?: string[] }) {
        const role = await prisma.role.findUnique({
            where: { id: roleId }
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        if (data.name && data.name !== role.name) {
            const existingRole = await prisma.role.findUnique({
                where: { name: data.name }
            });
            if (existingRole) {
                throw new BadRequestError('Role name already exists');
            }
        }

        // Using transaction for atomic update of permissions
        return prisma.$transaction(async (tx) => {
            if (data.permissionIds) {
                // Remove existing permissions
                await tx.rolePermission.deleteMany({
                    where: { role_id: roleId }
                });

                // Add new permissions
                await tx.rolePermission.createMany({
                    data: data.permissionIds.map(id => ({
                        role_id: roleId,
                        permission_id: id
                    }))
                });
            }

            return tx.role.update({
                where: { id: roleId },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.description !== undefined && { description: data.description })
                },
                include: {
                    permissions: {
                        include: {
                            permission: true
                        }
                    }
                }
            });
        });
    }

    async deleteRole(roleId: string) {
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: { users: true }
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        if (role.users.length > 0) {
            throw new BadRequestError('Cannot delete role with assigned users');
        }

        await prisma.role.delete({
            where: { id: roleId }
        });

        return { message: 'Role deleted successfully' };
    }

    async getAllPermissions() {
        return prisma.permission.findMany({
            orderBy: { name: 'asc' }
        });
    }
}
