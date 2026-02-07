const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdminUsers() {
    console.log('🔍 Checking for Admin users in database...\n');

    try {
        // Get all admin users
        const admins = await prisma.user.findMany({
            where: {
                role: {
                    in: ['ADMIN', 'SUPER_ADMIN']
                }
            },
            select: {
                id: true,
                email: true,
                full_name: true,
                role: true,
                email_verified: true,
                phone_verified: true,
                created_at: true
            }
        });

        if (admins.length === 0) {
            console.log('❌ No admin users found in database!\n');
            console.log('You need to run the seed script to create admin users.');
            return;
        }

        console.log(`✅ Found ${admins.length} admin user(s):\n`);

        admins.forEach((admin, index) => {
            console.log(`${index + 1}. ${admin.role}`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   Name: ${admin.full_name}`);
            console.log(`   Email Verified: ${admin.email_verified}`);
            console.log(`   Phone Verified: ${admin.phone_verified}`);
            console.log(`   Created: ${admin.created_at}`);
            console.log('');
        });

        console.log('📝 Default Password (from seed): password123\n');
        console.log('💡 Note: Passwords are hashed in the database for security.');

    } catch (error) {
        console.error('❌ Error querying database:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdminUsers();
