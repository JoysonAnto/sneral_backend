import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const items = await prisma.bookingItem.count();
    console.log('Booking Items count:', items);
    await prisma.$disconnect();
}

check();
