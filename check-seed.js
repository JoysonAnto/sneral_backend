const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSeedData() {
    try {
        console.log('\n🔍 Checking Seed Data in Database...\n');

        // Check total users
        const totalUsers = await prisma.user.count();
        console.log(`📊 Total Users in DB: ${totalUsers}`);

        // Check users by role
        const usersByRole = await prisma.user.groupBy({
            by: ['role'],
            _count: true,
        });

        console.log('\n👥 Users by Role:');
        usersByRole.forEach(group => {
            console.log(`   ${group.role}: ${group._count}`);
        });

        // Get all user emails
        const users = await prisma.user.findMany({
            select: {
                email: true,
                role: true,
                full_name: true,
            },
            orderBy: {
                role: 'asc',
            },
        });

        console.log('\n📧 All Users:');
        console.log('================');
        users.forEach(user => {
            console.log(`${user.role.padEnd(20)} | ${user.email.padEnd(35)} | ${user.full_name}`);
        });

        // Check Business Partner specifically
        const businessPartner = await prisma.user.findUnique({
            where: { email: 'homecare@business.com' },
            include: {
                business_partner: true,
            },
        });

        console.log('\n🏢 Business Partner Account:');
        if (businessPartner) {
            console.log('✅ FOUND:', businessPartner.email);
            console.log('   Role:', businessPartner.role);
            console.log('   Name:', businessPartner.full_name);
            console.log('   Has BP Record:', businessPartner.business_partner ? 'YES' : 'NO');
        } else {
            console.log('❌ NOT FOUND: homecare@business.com');
        }

        // Check categories
        const categories = await prisma.category.count();
        console.log(`\n📂 Total Categories: ${categories}`);

        // Check services
        const services = await prisma.service.count();
        console.log(`⚙️ Total Services: ${services}`);

        // Check bookings
        const bookings = await prisma.booking.count();
        console.log(`📅 Total Bookings: ${bookings}`);

        console.log('\n✅ Database check complete!\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSeedData();
