import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('--- Updating District Coordinates ---');

    // Bangalore: 12.9716, 77.5946
    await prisma.district.updateMany({
        where: { name: 'Bangalore Urban' },
        data: {
            latitude: 12.9716,
            longitude: 77.5946
        }
    });

    // Chennai: 13.0827, 80.2707
    await prisma.district.updateMany({
        where: { name: 'Chennai' },
        data: {
            latitude: 13.0827,
            longitude: 80.2707
        }
    });

    console.log('Updated coordinates for Bangalore and Chennai.');

    await prisma.$disconnect();
}

check();
