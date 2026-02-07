const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickCheck() {
    const total = await prisma.user.count();
    console.log('Total users:', total);

    const bp = await prisma.user.findUnique({
        where: { email: 'homecare@business.com' }
    });

    console.log('\nBusiness Partner (homecare@business.com):', bp ? 'EXISTS ✅' : 'NOT FOUND ❌');

    if (bp) {
        console.log('Role:', bp.role);
        console.log('Name:', bp.full_name);
        console.log('Email Verified:', bp.email_verified);
    }

    const ramesh = await prisma.user.findUnique({
        where: { email: 'ramesh.electrician@service.com' }
    });

    console.log('\nService Partner (ramesh.electrician@service.com):', ramesh ? 'EXISTS ✅' : 'NOT FOUND ❌');

    if (ramesh) {
        console.log('Role:', ramesh.role);
    }

    await prisma.$disconnect();
}

quickCheck().catch(console.error);
