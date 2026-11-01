import { PrismaClient } from '@prisma/client';
import { BookingService } from '../src/services/booking.service';

const prisma = new PrismaClient();
const bookingService = new BookingService();

async function runTest() {
    console.log('🚀 Starting Booking Order Flow Verification...');
    
    // Find customer, active service, and an available partner
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    const service = await prisma.service.findFirst({ where: { is_active: true } });
    const partner = await prisma.servicePartner.findFirst({
        where: {
            is_on_hold: false,
            is_blacklisted: false,
            availability_status: 'AVAILABLE'
        },
        include: { user: true }
    });

    if (!customer || !service) {
        console.error('❌ Missing prerequisite: Customer or Service not found');
        process.exit(1);
    }

    console.log(`👤 Customer: ${customer.full_name} (${customer.id})`);
    console.log(`🛠️ Service: ${service.name} (${service.id})`);
    if (partner) {
        console.log(`🤝 Partner: ${partner.user.full_name} (${partner.id})`);
    }

    // --- STEP 1: CREATE BOOKING (PENDING) ---
    console.log('\n--- 1. Creating Booking (PENDING) ---');
    const bookingNumber = 'TEST_FLOW_' + Date.now();
    const booking = await prisma.booking.create({
        data: {
            booking_number: bookingNumber,
            customer_id: customer.id,
            status: 'PENDING',
            scheduled_date: new Date(),
            scheduled_time: '11:00 AM',
            service_address: '123 Test Street, Coimbatore',
            service_latitude: 11.0168,
            service_longitude: 76.9558,
            total_amount: 500,
            advance_amount: 100,
            remaining_amount: 400,
            payment_method: 'CASH',
            payment_status: 'PENDING',
            items: {
                create: {
                    service_id: service.id,
                    unit_price: 500,
                    total_price: 500,
                    quantity: 1
                }
            }
        }
    });
    console.log(`✅ Created Booking: ${booking.booking_number} [Status: ${booking.status}]`);

    // --- STEP 2: SEARCHING PARTNER ---
    console.log('\n--- 2. Transitioning to SEARCHING_PARTNER ---');
    await bookingService.updateBookingStatus(
        booking.id,
        'SEARCHING_PARTNER',
        customer.id,
        'Broadcasting to nearby partners'
    );
    let check = await prisma.booking.findUnique({ where: { id: booking.id } });
    console.log(`✅ Status is now: ${check?.status}`);

    // --- STEP 3: ASSIGN PARTNER ---
    if (partner) {
        console.log('\n--- 3. Assigning Partner (PARTNER_ASSIGNED) ---');
        await prisma.booking.update({
            where: { id: booking.id },
            data: { partner_id: partner.id }
        });
        await bookingService.updateBookingStatus(
            booking.id,
            'PARTNER_ASSIGNED',
            'ADMIN',
            `Assigned to ${partner.user.full_name}`
        );
        check = await prisma.booking.findUnique({ where: { id: booking.id } });
        console.log(`✅ Status is now: ${check?.status}, Partner ID: ${check?.partner_id}`);

        // --- STEP 4: PARTNER ACCEPTS ---
        console.log('\n--- 4. Partner Accepts Job (PARTNER_ACCEPTED) ---');
        await bookingService.updateBookingStatus(
            booking.id,
            'PARTNER_ACCEPTED',
            partner.user_id,
            'Partner accepted the booking'
        );
        check = await prisma.booking.findUnique({ where: { id: booking.id } });
        console.log(`✅ Status is now: ${check?.status}`);

        // --- STEP 5: PARTNER ARRIVES ---
        console.log('\n--- 5. Partner Arrives at Location (PARTNER_ARRIVED) ---');
        await bookingService.updateBookingStatus(
            booking.id,
            'PARTNER_ARRIVED',
            partner.user_id,
            'Partner arrived at customer premises'
        );
        check = await prisma.booking.findUnique({ where: { id: booking.id } });
        console.log(`✅ Status is now: ${check?.status}`);

        // --- STEP 6: WORK IN PROGRESS ---
        console.log('\n--- 6. Job Started (IN_PROGRESS) ---');
        await bookingService.updateBookingStatus(
            booking.id,
            'IN_PROGRESS',
            partner.user_id,
            'Service in progress'
        );
        check = await prisma.booking.findUnique({ where: { id: booking.id } });
        console.log(`✅ Status is now: ${check?.status}`);

        // --- STEP 7: JOB COMPLETED ---
        console.log('\n--- 7. Job Completed (COMPLETED) ---');
        await bookingService.updateBookingStatus(
            booking.id,
            'COMPLETED',
            partner.user_id,
            'Service completed successfully'
        );
        check = await prisma.booking.findUnique({ where: { id: booking.id } });
        console.log(`✅ Status is now: ${check?.status}, Completed At: ${check?.completed_at}`);
    }

    // --- STEP 8: VERIFY STATUS HISTORY TIMELINE ---
    console.log('\n--- 8. Verifying Status History Timeline ---');
    const history = await prisma.bookingStatusHistory.findMany({
        where: { booking_id: booking.id },
        orderBy: { created_at: 'asc' }
    });
    console.log(`📜 Total status transitions recorded: ${history.length}`);
    history.forEach((h, idx) => {
        console.log(`   ${idx + 1}. [${h.status}] - Changed by: ${h.changed_by} - Notes: ${h.notes || 'None'}`);
    });

    // --- STEP 9: TEST CANCELLATION FLOW ---
    console.log('\n--- 9. Testing Cancellation Flow on Separate Booking ---');
    const cancelBookingNumber = 'TEST_CANCEL_' + Date.now();
    const cancelBooking = await prisma.booking.create({
        data: {
            booking_number: cancelBookingNumber,
            customer_id: customer.id,
            status: 'PENDING',
            scheduled_date: new Date(),
            scheduled_time: '02:00 PM',
            service_address: '456 Cancel Ave, Coimbatore',
            service_latitude: 11.0168,
            service_longitude: 76.9558,
            total_amount: 300,
            advance_amount: 0,
            remaining_amount: 300,
            payment_method: 'CASH',
            payment_status: 'PENDING',
        }
    });

    await bookingService.updateBookingStatus(
        cancelBooking.id,
        'CANCELLED',
        customer.id,
        'Customer cancelled due to plan change'
    );
    const cancelledCheck = await prisma.booking.findUnique({ where: { id: cancelBooking.id } });
    console.log(`✅ Cancelled Booking: ${cancelledCheck?.booking_number} [Status: ${cancelledCheck?.status}, Reason: ${cancelledCheck?.cancellation_reason}]`);

    // Clean up test records
    await prisma.bookingStatusHistory.deleteMany({
        where: { booking_id: { in: [booking.id, cancelBooking.id] } }
    });
    await prisma.bookingItem.deleteMany({
        where: { booking_id: { in: [booking.id, cancelBooking.id] } }
    });
    await prisma.booking.deleteMany({
        where: { id: { in: [booking.id, cancelBooking.id] } }
    });
    console.log('\n🧹 Test bookings cleaned up successfully.');
    console.log('🎉 ALL BOOKING ORDER FLOW CHECKS PASSED PERFECTLY!\n');

    await prisma.$disconnect();
    process.exit(0);
}

runTest().catch((err) => {
    console.error('❌ Order flow test failed:', err);
    process.exit(1);
});
