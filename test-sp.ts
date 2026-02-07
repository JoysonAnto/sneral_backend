import prisma from './src/config/database';

async function run() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'ramesh.electrician@service.com' },
            include: { service_partner: true }
        });
        console.log('User:', user?.id);
        console.log('SP:', user?.service_partner ? 'FOUND' : 'NOT FOUND');
        if (user?.service_partner) {
            console.log('SP ID:', user.service_partner.id);
            const sp = await prisma.servicePartner.findUnique({
                where: { user_id: user.id },
                include: { services: true }
            });
            console.log('SP via user_id:', sp ? 'FOUND' : 'NOT FOUND');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
