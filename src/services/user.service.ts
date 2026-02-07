import prisma from '../config/database';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../utils/errors';
import { hashPassword } from '../utils/encryption';

interface CreateAdminData {
    email: string;
    password: string;
    fullName: string;
    role?: 'ADMIN' | 'SUPER_ADMIN';
}

export class UserService {
    async getAllUsers(filters: any) {
        const { role, search, page = 1, limit = 20, isActive: _isActive } = filters;

        const skip = (page - 1) * limit;

        let where: any = {};

        if (role) {
            where.role = role;
        }

        // is_active filter removed - field doesn't exist in schema

        if (search) {
            where.OR = [
                { full_name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                select: {
                    id: true,
                    email: true,
                    full_name: true,
                    phone_number: true,
                    role: true,
                    email_verified: true,
                    created_at: true,
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
                phoneNumber: u.phone_number,
                role: u.role,
                emailVerified: u.email_verified,
                createdAt: u.created_at,
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
            where: { email: data.email },
        });

        if (existingUser) {
            throw new BadRequestError('Email already registered');
        }

        // Hash password
        const hashedPassword = await hashPassword(data.password);

        // Create admin user
        const admin = await prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                full_name: data.fullName,
                role: data.role || 'ADMIN',
                email_verified: true, // Auto-verify admin accounts
            },
        });

        return {
            id: admin.id,
            email: admin.email,
            fullName: admin.full_name,
            role: admin.role,
            createdAt: admin.created_at,
        };
    }

    async updateUser(userId: string, data: any) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.fullName && { full_name: data.fullName }),
                ...(data.phoneNumber && { phone_number: data.phoneNumber }),
            },
            select: {
                id: true,
                email: true,
                full_name: true,
                phone_number: true,
                role: true,
                updated_at: true,
            },
        });

        return {
            id: updated.id,
            email: updated.email,
            fullName: updated.full_name,
            phoneNumber: updated.phone_number,
            role: updated.role,
            updatedAt: updated.updated_at,
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
