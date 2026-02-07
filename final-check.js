const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalCheck() {
    console.log('\n📊 FINAL DATABASE CHECK\n');
    console.log('==================================================');

    const users = await prisma.user.findMany({
        select: { email: true, role: true, full_name: true },
        orderBy: { role: 'asc' }
    });

    console.log(`\nTotal Users: ${users.length}\n`);

    users.forEach(u => {
        const marker = u.email === 'homecare@business.com' ? '✅' : '  ';
        console.log(`${marker} ${u.role.padEnd(18)} | ${u.email}`);
    });

    const bp = users.find(u => u.email === 'homecare@business.com');

    console.log('\n' + '='.repeat(50));
    console.log('\n🏢 BUSINESS PARTNER STATUS:');
    if (bp) {
        console.log('✅ FOUND!');
        console.log(`   Email: home care@business.com`);
        console.log(`   Password: password123`);
        console.log(`   Role: ${bp.role}`);
        console.log(`   Name: ${bp.full_name}`);
    } else {
        console.log('❌ NOT FOUND');
    }

    const categories = await prisma.category.count();
    const services = await prisma.service.count();

    console.log('\n📂 Categories:', categories);
    console.log('⚙️  Services:', services);
    console.log('\n✅ Database is ready!\n');

    await prisma.$disconnect();
}

finalCheck().catch(console.error);
