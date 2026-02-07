
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const bookings = await prisma.booking.findMany({
        include: {
            customer: true,
            partner: { include: { user: true } },
            items: { include: { service: true } }
        }
    });
    console.log('Total bookings:', bookings.length);
    bookings.forEach(b => {
        console.log(`- BK: ${b.booking_number}, Status: ${b.status}, Customer: ${b.customer.full_name}, Service: ${b.items[0]?.service?.name}`);
    });
    process.exit(0);
}
main();
