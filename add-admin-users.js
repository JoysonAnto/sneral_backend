const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addAdminUsers() {
    console.log('\n👨‍💼 Adding Admin Users...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Check if admin exists
    const existing = await prisma.user.findUnique({
        where: { email: 'admin@snearal.com' }
    });

    if (existing) {
        console.log('✅ Admin already exists!');
        console.log('   Email: admin@snearal.com');
        await prisma.$disconnect();
        return;
    }

    // Create Super Admin
    const superAdmin = await prisma.user.create({
        data: {
            email: 'superadmin@snearal.com',
            password: hashedPassword,
            full_name: 'Super Administrator',
            phone_number: '+919999999999',
            role: 'SUPER_ADMIN',
            email_verified: true,
            phone_verified: true,
        },
    });

    await prisma.profile.create({
        data: {
            user_id: superAdmin.id,
            address: 'Corporate Office, MG Road',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560001',
            country: 'India',
        },
    });

    await prisma.wallet.create({
        data: { user_id: superAdmin.id, balance: 0 },
    });

    // Create Admin
    const admin = await prisma.user.create({
        data: {
            email: 'admin@snearal.com',
            password: hashedPassword,
            full_name: 'John Anderson',
            phone_number: '+919876543210',
            role: 'ADMIN',
            email_verified: true,
            phone_verified: true,
        },
    });

    await prisma.profile.create({
        data: {
            user_id: admin.id,
            address: '456 Admin Tower, Whitefield',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560066',
            country: 'India',
        },
    });

    await prisma.wallet.create({
        data: { user_id: admin.id, balance: 0 },
    });

    console.log('✅ Admin users added successfully!\n');
    console.log('📧 Login Credentials:\n');
    console.log('Super Admin:');
    console.log('  Email: superadmin@snearal.com');
    console.log('  Password: password123');
    console.log('\nAdmin:');
    console.log('  Email: admin@snearal.com');
    console.log('  Password: password123\n');

    await prisma.$disconnect();
}

addAdminUsers().catch(console.error);
