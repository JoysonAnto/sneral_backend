
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    const service = await prisma.service.findFirst({ where: { is_active: true } });
    if (!customer || !service) {
        console.error('Customer or Service not found');
        process.exit(1);
    }
    const booking = await prisma.booking.create({
        data: {
            booking_number: 'BK_TEST_' + Date.now(),
            customer_id: customer.id,
            status: 'PENDING',
            scheduled_date: new Date(),
            scheduled_time: '10:00 AM',
            service_address: 'Test Address',
            service_latitude: 12.9716,
            service_longitude: 77.5946,
            total_amount: 1000,
            advance_amount: 300,
            remaining_amount: 700,
            payment_method: 'CASH',
            payment_status: 'PENDING',
            items: {
                create: {
                    service_id: service.id,
                    unit_price: 1000,
                    total_price: 1000,
                    quantity: 1
                }
            }
        }
    });
    console.log('Created pending booking:', booking.booking_number);
    process.exit(0);
}
main();
