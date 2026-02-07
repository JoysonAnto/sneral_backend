const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.findMany({
            select: { email: true, role: true, full_name: true }
        });
        console.log('--- USER LIST ---');
        users.forEach(u => console.log(`${u.email} | ${u.role} | ${u.full_name}`));
        console.log('-----------------');
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
