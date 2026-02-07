const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdminUsers() {
    console.log('👨‍💼 Creating Admin Users...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    try {
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
                profile: {
                    create: {
                        address: 'Corporate Office, MG Road',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560001',
                        country: 'India',
                    },
                },
                wallet: { create: { balance: 0 } },
            },
        });

        console.log('✅ Created SUPER_ADMIN:');
        console.log(`   Email: ${superAdmin.email}`);
        console.log(`   Name: ${superAdmin.full_name}`);
        console.log('');

        // Create Regular Admin
        const admin = await prisma.user.create({
            data: {
                email: 'admin@snearal.com',
                password: hashedPassword,
                full_name: 'John Anderson',
                phone_number: '+919876543210',
                role: 'ADMIN',
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '456 Admin Tower, Whitefield',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560066',
                        country: 'India',
                    },
                },
                wallet: { create: { balance: 0 } },
            },
        });

        console.log('✅ Created ADMIN:');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Name: ${admin.full_name}`);
        console.log('');

        console.log('═══════════════════════════════════════');
        console.log('🎉 Admin Users Created Successfully!');
        console.log('═══════════════════════════════════════');
        console.log('');
        console.log('📝 Login Credentials:');
        console.log('   Email: admin@snearal.com OR superadmin@snearal.com');
        console.log('   Password: password123');
        console.log('');
        console.log('🌐 Admin Dashboard: http://localhost:3001/login');
        console.log('');

    } catch (error) {
        if (error.code === 'P2002') {
            console.log('⚠️  Admin users already exist in the database.');
            console.log('   Email: admin@snearal.com OR superadmin@snearal.com');
            console.log('   Password: password123');
        } else {
            console.error('❌ Error creating admin users:', error.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

createAdminUsers();
