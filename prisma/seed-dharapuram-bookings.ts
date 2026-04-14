import { PrismaClient, BookingStatus, BookingType, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDharapuramBookings() {
    console.log('📅 Seeding Dharapuram bookings for the next 4 days...');

    // 1. Get our specific players
    const partner = await prisma.servicePartner.findFirst({
        where: { user: { email: 'suresh.plumber@service.com' } },
        include: { user: true }
    });

    const customers = await prisma.user.findMany({
        where: { email: { in: ['rajesh.kumar@gmail.com', 'amit.patel@yahoo.com'] } }
    });

    const services = await prisma.service.findMany({
        where: { name: { in: ['Tap Repair (Leakage)', 'Bathroom Plumbing', 'Toilet Flush Repair', 'Plumbing Consultation/Visit'] } }
    });

    if (!partner || customers.length < 2 || services.length < 2) {
        console.error('❌ Could not find required partner, customers or services.');
        console.log('Partner found:', !!partner);
        console.log('Customers found:', customers.length);
        console.log('Services found:', services.length);
        return;
    }

    const dharapuramLat = 10.7333;
    const dharapuramLng = 77.5167;
    const dharapuramAddress = 'Main Road, Dharapuram, Tamil Nadu';

    const now = new Date();
    
    // Helper to generate booking number
    const genBookingNum = () => `BK-${Math.floor(100000 + Math.random() * 900000)}`;

    const bookingsToCreate = [];

    // Day 0: Today - Instant Booking
    bookingsToCreate.push({
        booking_number: genBookingNum(),
        customer_id: customers[0].id,
        partner_id: partner.id,
        status: BookingStatus.PARTNER_ASSIGNED,
        booking_type: BookingType.INSTANT,
        scheduled_date: now,
        scheduled_time: 'ASAP',
        service_address: dharapuramAddress,
        service_latitude: dharapuramLat,
        service_longitude: dharapuramLng,
        total_amount: services[0].base_price,
        remaining_amount: services[0].base_price,
        payment_status: PaymentStatus.PENDING,
        created_at: now,
        is_scheduled: false,
        items: {
            create: [{
                service_id: services[0].id,
                quantity: 1,
                unit_price: services[0].base_price,
                total_price: services[0].base_price
            }]
        }
    });

    // Day 0: Today - Scheduled Booking
    const todayEvening = new Date(now);
    todayEvening.setHours(18, 0, 0, 0);
    bookingsToCreate.push({
        booking_number: genBookingNum(),
        customer_id: customers[1].id,
        partner_id: partner.id,
        status: BookingStatus.PARTNER_ASSIGNED,
        booking_type: BookingType.SCHEDULED,
        scheduled_date: todayEvening,
        scheduled_time: '06:00 PM',
        service_address: dharapuramAddress,
        service_latitude: dharapuramLat,
        service_longitude: dharapuramLng,
        total_amount: services[1].base_price,
        remaining_amount: services[1].base_price,
        payment_status: PaymentStatus.PENDING,
        created_at: now,
        is_scheduled: true,
        items: {
            create: [{
                service_id: services[1].id,
                quantity: 1,
                unit_price: services[1].base_price,
                total_price: services[1].base_price
            }]
        }
    });

    // Day 1 to 3
    for (let i = 1; i <= 3; i++) {
        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + i);
        futureDate.setHours(10 + i, 0, 0, 0); // Varying times: 11 AM, 12 PM, 1 PM

        const svc = services[i % services.length];
        const cust = customers[i % customers.length];

        bookingsToCreate.push({
            booking_number: genBookingNum(),
            customer_id: cust.id,
            partner_id: partner.id,
            status: BookingStatus.PARTNER_ASSIGNED,
            booking_type: BookingType.SCHEDULED,
            scheduled_date: futureDate,
            scheduled_time: `${futureDate.getHours() % 12 || 12}:00 ${futureDate.getHours() >= 12 ? 'PM' : 'AM'}`,
            service_address: dharapuramAddress,
            service_latitude: dharapuramLat,
            service_longitude: dharapuramLng,
            total_amount: svc.base_price,
            remaining_amount: svc.base_price,
            payment_status: PaymentStatus.PENDING,
            created_at: now,
            is_scheduled: true,
            items: {
                create: [{
                    service_id: svc.id,
                    quantity: 1,
                    unit_price: svc.base_price,
                    total_price: svc.base_price
                }]
            }
        });
    }

    console.log(`🚀 Creating ${bookingsToCreate.length} bookings for Dharapuram...`);

    for (const bData of bookingsToCreate) {
        await prisma.booking.create({
            data: bData
        });
        console.log(`✅ Created Booking: ${bData.booking_number} for Date: ${bData.scheduled_date.toDateString()}`);
    }

    console.log('\n✨ Dharapuram bookings seeded successfully!');
    await prisma.$disconnect();
}

seedDharapuramBookings().catch(e => {
    console.error(e);
    process.exit(1);
});
