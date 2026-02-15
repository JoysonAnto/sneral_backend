const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
async function check() {
    try {
        const notifications = await prisma.notification.findMany({
            include: { user: true },
            orderBy: { created_at: 'desc' },
            take: 10
        });
        console.log(JSON.stringify(notifications, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
