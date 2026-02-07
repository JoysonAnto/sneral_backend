const { PrismaClient, BookingStatus, PaymentStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function addSampleBookings() {
    console.log('🎯 Adding sample bookings to database...\n');

    try {
        // Get existing data
        const customers = await prisma.user.findMany({
            where: { role: 'CUSTOMER' },
            take: 5,
            include: { profile: true }
        });

        const partners = await prisma.servicePartner.findMany({
            take: 4
        });

        const services = await prisma.service.findMany({
            take: 10
        });

        if (customers.length === 0) {
            console.log('❌ No customers found. Please run seed first.');
            return;
        }

        console.log(`Found ${customers.length} customers, ${partners.length} partners, ${services.length} services\n`);

        // Sample bookings data - mostly without partners since DB has none
        const bookingsData = [
            {
                customerIndex: 0,
                serviceIndex: 1,
                status: BookingStatus.PENDING,
                scheduledDate: new Date('2026-01-27T10:00:00'),
                scheduledTime: '10:00 AM',
                totalAmount: 549,
                advanceAmount: 200,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 1,
                serviceIndex: 0,
                status: BookingStatus.SEARCHING_PARTNER,
                scheduledDate: new Date('2026-01-28T14:00:00'),
                scheduledTime: '2:00 PM',
                totalAmount: 1899,
                advanceAmount: 500,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 2,
                serviceIndex: 2,
                status: BookingStatus.PENDING,
                scheduledDate: new Date('2026-01-29T09:00:00'),
                scheduledTime: '9:00 AM',
                totalAmount: 279,
                advanceAmount: 100,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 3,
                serviceIndex: 7,
                status: BookingStatus.PENDING,
                scheduledDate: new Date('2026-01-30T16:00:00'),
                scheduledTime: '4:00 PM',
                totalAmount: 799,
                advanceAmount: 0,
                paymentStatus: PaymentStatus.PENDING,
            },
            {
                customerIndex: 4,
                serviceIndex: 5,
                status: BookingStatus.SEARCHING_PARTNER,
                scheduledDate: new Date('2026-01-31T11:00:00'),
                scheduledTime: '11:00 AM',
                totalAmount: 2799,
                advanceAmount: 1000,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 0,
                serviceIndex: 8,
                status: BookingStatus.PENDING,
                scheduledDate: new Date('2026-02-01T13:00:00'),
                scheduledTime: '1:00 PM',
                totalAmount: 599,
                advanceAmount: 200,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 1,
                serviceIndex: 3,
                status: BookingStatus.SEARCHING_PARTNER,
                scheduledDate: new Date('2026-02-02T10:00:00'),
                scheduledTime: '10:00 AM',
                totalAmount: 399,
                advanceAmount: 150,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 2,
                serviceIndex: 4,
                status: BookingStatus.PENDING,
                scheduledDate: new Date('2026-02-03T15:00:00'),
                scheduledTime: '3:00 PM',
                totalAmount: 249,
                advanceAmount: 100,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 3,
                serviceIndex: 6,
                status: BookingStatus.SEARCHING_PARTNER,
                scheduledDate: new Date('2026-01-26T09:00:00'),
                scheduledTime: '9:00 AM',
                totalAmount: 499,
                advanceAmount: 200,
                paymentStatus: PaymentStatus.PARTIAL,
            },
            {
                customerIndex: 4,
                serviceIndex: 9,
                status: BookingStatus.PENDING,
                scheduledDate: new Date('2026-01-25T08:00:00'),
                scheduledTime: '8:00 AM',
                totalAmount: 3999,
                advanceAmount: 1000,
                paymentStatus: PaymentStatus.PARTIAL,
            },
        ];

        let createdCount = 0;

        for (const data of bookingsData) {
            const customer = customers[data.customerIndex];
            const service = services[data.serviceIndex];

            if (!customer || !service) continue;

            const bookingNumber = `BK-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

            const booking = await prisma.booking.create({
                data: {
                    booking_number: bookingNumber,
                    customer_id: customer.id,
                    partner_id: null,
                    status: data.status,
                    scheduled_date: data.scheduledDate,
                    scheduled_time: data.scheduledTime,
                    service_address: customer.profile?.address || 'Bangalore, Karnataka',
                    service_latitude: customer.profile?.latitude || 12.9716,
                    service_longitude: customer.profile?.longitude || 77.5946,
                    total_amount: data.totalAmount,
                    advance_amount: data.advanceAmount,
                    remaining_amount: data.totalAmount - data.advanceAmount,
                    payment_status: data.paymentStatus,
                    items: {
                        create: {
                            service_id: service.id,
                            service_name: service.name,
                            quantity: 1,
                            unit_price: data.totalAmount,
                            total_price: data.totalAmount,
                        }
                    }
                }
            });

            createdCount++;
            console.log(`✅ Created booking ${bookingNumber} - ${data.status} - ₹${data.totalAmount}`);
        }

        console.log(`\n🎉 Successfully created ${createdCount} sample bookings!`);
    } catch (error) {
        console.error('❌ Error creating bookings:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addSampleBookings();
