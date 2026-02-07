import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const districts = await prisma.district.findMany({
        select: { id: true, name: true, is_active: true }
    });
    console.log('Districts:', JSON.stringify(districts, null, 2));

    const services = await prisma.service.findMany({
        take: 5,
        include: { category: true }
    });
    console.log('Sample Services with Category:', JSON.stringify(services, null, 2));

    await prisma.$disconnect();
}

check();
