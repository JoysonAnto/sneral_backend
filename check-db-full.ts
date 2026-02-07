import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const usersCount = await prisma.user.count();
    const spCount = await prisma.servicePartner.count();
    const bpCount = await prisma.businessPartner.count();
    const bookingsCount = await prisma.booking.count();
    const servicesCount = await prisma.service.count();
    const categoriesCount = await prisma.category.count();

    console.log('--- DB Stats ---');
    console.log('Users:', usersCount);
    console.log('Service Partners:', spCount);
    console.log('Business Partners:', bpCount);
    console.log('Bookings:', bookingsCount);
    console.log('Services:', servicesCount);
    console.log('Categories:', categoriesCount);

    const bookings = await prisma.booking.findMany({ take: 5 });
    console.log('Recent Bookings:', JSON.stringify(bookings, null, 2));

    await prisma.$disconnect();
}

check();
