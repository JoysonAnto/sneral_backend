
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const count = await prisma.booking.count();
    console.log('Bookings count:', count);
    const bookings = await prisma.booking.findMany({
        take: 5,
        include: { customer: true, partner: true }
    });
    console.log('Sample bookings:', JSON.stringify(bookings, null, 2));
    process.exit(0);
}
main();
