import prisma from '../config/database';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../utils/errors';
import { hashPassword } from '../utils/encryption';

interface CreateAdminData {
    email: string;
    password: string;
    fullName: string;
    role?: 'ADMIN' | 'SUPER_ADMIN';
    roleId?: string;
}

export class UserService {
    async getAllUsers(filters: any) {
        const { role, type, search, page = 1, limit = 20, isActive } = filters;

        const skip = (page - 1) * limit;

        let where: any = {};

        if (type === 'portal' || type === 'staff') {
            where.OR = [
                { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
                { role_id: { not: null } }
            ];
        } else if (type === 'customers' || type === 'customer') {
            where.role = 'CUSTOMER';
        } else if (role) {
            where.role = role;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === 'true' || isActive === true;
        }

        if (search) {
            const searchCondition = [
                { full_name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone_number: { contains: search, mode: 'insensitive' } },
            ];
            if (where.OR) {
                where.AND = [
                    { OR: where.OR },
                    { OR: searchCondition }
                ];
                delete where.OR;
            } else {
                where.OR = searchCondition;
            }
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    custom_role: {
                        include: {
                            permissions: {
                                include: { permission: true }
                            }
                        }
                    },
                    _count: {
                        select: { bookings: true }
                    }
                },
                orderBy: { created_at: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                fullName: u.full_name,
                full_name: u.full_name,
                phoneNumber: u.phone_number,
                phone_number: u.phone_number,
                role: u.role,
                roleId: u.role_id,
                role_id: u.role_id,
                isActive: u.is_active,
                is_active: u.is_active,
                customRole: (u as any).custom_role,
                custom_role: (u as any).custom_role,
                emailVerified: u.email_verified,
                createdAt: u.created_at,
                created_at: u.created_at,
                bookingsCount: (u as any)._count?.bookings || 0,
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
            },
        };
    }

    async getUserById(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                service_partner: true,
                business_partner: true,
                wallet: true,
                custom_role: true,
            },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const { password: _password, verification_otp: _verification_otp, otp_expires_at: _otp_expires_at, reset_otp: _reset_otp, reset_otp_expiry: _reset_otp_expiry, ...userWithoutSensitive } = user as any;

        return userWithoutSensitive;
    }

    async createAdmin(data: CreateAdminData, creatorRole: string) {
        // Only SUPER_ADMIN can create admins
        if (creatorRole !== 'SUPER_ADMIN') {
            throw new UnauthorizedError('Only Super Admin can create admin accounts');
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email.toLowerCase().trim() },
        });

        if (existingUser) {
            throw new BadRequestError('Email already registered');
        }

        // Hash password
        const hashedPassword = await hashPassword(data.password);

        // Create admin user
        const admin = await prisma.user.create({
            data: {
                email: data.email.toLowerCase().trim(),
                password: hashedPassword,
                full_name: data.fullName.trim(),
                phone_number: (data as any).phoneNumber || (data as any).phone_number || null,
                role: data.role || 'ADMIN',
                role_id: data.roleId || (data as any).role_id || null,
                email_verified: true, // Auto-verify admin accounts
                phone_verified: true,
                is_active: true,
            },
            include: {
                custom_role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                }
            }
        });

        const a = admin as any;
        return {
            id: a.id,
            email: a.email,
            fullName: a.full_name,
            full_name: a.full_name,
            phoneNumber: a.phone_number,
            phone_number: a.phone_number,
            role: a.role,
            roleId: a.role_id,
            role_id: a.role_id,
            customRole: a.custom_role,
            custom_role: a.custom_role,
            isActive: a.is_active,
            is_active: a.is_active,
            createdAt: a.created_at,
        };
    }

    async updateUser(userId: string, data: any) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const updateData: any = {};
        if (data.fullName !== undefined) updateData.full_name = data.fullName.trim();
        if (data.full_name !== undefined) updateData.full_name = data.full_name.trim();

        if (data.email !== undefined) {
            const trimmedEmail = data.email.toLowerCase().trim();
            if (trimmedEmail !== user.email) {
                const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
                if (existing && existing.id !== userId) {
                    throw new BadRequestError('Email is already taken by another user');
                }
                updateData.email = trimmedEmail;
            }
        }

        if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber ? data.phoneNumber.trim() : null;
        if (data.phone_number !== undefined) updateData.phone_number = data.phone_number ? data.phone_number.trim() : null;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.roleId !== undefined) updateData.role_id = data.roleId || null;
        if (data.role_id !== undefined) updateData.role_id = data.role_id || null;
        if (data.isActive !== undefined) updateData.is_active = Boolean(data.isActive);
        if (data.is_active !== undefined) updateData.is_active = Boolean(data.is_active);

        if (data.password && String(data.password).trim()) {
            updateData.password = await hashPassword(String(data.password).trim());
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: {
                custom_role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                }
            }
        });

        const u = updated as any;
        return {
            id: u.id,
            email: u.email,
            fullName: u.full_name,
            full_name: u.full_name,
            phoneNumber: u.phone_number,
            phone_number: u.phone_number,
            role: u.role,
            roleId: u.role_id,
            role_id: u.role_id,
            customRole: u.custom_role,
            custom_role: u.custom_role,
            isActive: u.is_active,
            is_active: u.is_active,
            updatedAt: u.updated_at,
        };
    }

    async deleteUser(userId: string, deletorRole: string) {
        // Only SUPER_ADMIN can delete users
        if (deletorRole !== 'SUPER_ADMIN') {
            throw new UnauthorizedError('Only Super Admin can delete users');
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // User deleted successfully
        await prisma.user.delete({
            where: { id: userId },
        });

        return { message: 'User deactivated successfully' };
    }
}
