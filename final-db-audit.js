const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
    console.log('🔍 Starting Final Database Audit...\n');

    try {
        // 1. User Summary
        const roles = ['CUSTOMER', 'ADMIN', 'SERVICE_PARTNER', 'BUSINESS_PARTNER', 'SUPER_ADMIN'];
        console.log('👤 User Distribution:');
        for (const role of roles) {
            const count = await prisma.user.count({ where: { role } });
            console.log(`  - ${role}: ${count}`);
        }

        // 2. Service Catalog
        const categoryCount = await prisma.category.count();
        const serviceCount = await prisma.service.count();
        console.log(`\n📂 Catalog Summary:`);
        console.log(`  - Categories: ${categoryCount}`);
        console.log(`  - Services: ${serviceCount}`);

        // 3. Partner Health
        const partners = await prisma.servicePartner.findMany({
            include: { user: { select: { email: true } } }
        });
        console.log(`\n🛠️  Service Partner Health (${partners.length} total):`);
        partners.forEach(p => {
            console.log(`  - ${p.user.email}: Availability=${p.availability_status}, KYC=${p.kyc_status}`);
        });

        const activePartners = await prisma.servicePartner.count({
            where: {
                availability_status: 'AVAILABLE',
                kyc_status: 'APPROVED'
            }
        });
        console.log(`\n✅ Active & Verified Count: ${activePartners}`);

        // 4. Booking Status
        const totalBookings = await prisma.booking.count();
        const recentBookings = await prisma.booking.findMany({
            take: 5,
            orderBy: { created_at: 'desc' },
            select: {
                booking_number: true,
                status: true,
                total_amount: true,
                created_at: true,
                customer: { select: { email: true } }
            }
        });

        console.log(`\n📅 Booking Summary (Total: ${totalBookings}):`);
        if (recentBookings.length > 0) {
            recentBookings.forEach(b => {
                console.log(`  - [${b.booking_number}] Status: ${b.status} | Amt: ${b.total_amount} | User: ${b.customer.email}`);
            });
        } else {
            console.log('  - No bookings found.');
        }

        // 5. Area Coverage
        const areaCount = await prisma.area.count();
        console.log(`\n📍 Service Areas Covered: ${areaCount}`);

        console.log('\n✅ Audit Complete.');
    } catch (error) {
        console.error('\n❌ Audit Failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

audit();
