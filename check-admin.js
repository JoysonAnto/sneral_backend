const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
    const admin = await prisma.user.findUnique({
        where: { email: 'admin@snearal.com' }
    });

    console.log('Admin User:');
    console.log('  Email:', admin?.email);
    console.log('  Name:', admin?.full_name);
    console.log('  Role:', admin?.role);
    console.log('  Is Active:', admin?.is_active);
    console.log('  Email Verified:', admin?.email_verified);
    console.log('  Phone Verified:', admin?.phone_verified);

    await prisma.$disconnect();
}

checkAdmin();
