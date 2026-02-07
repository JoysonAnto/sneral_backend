import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function runCheck() {
    console.log('🚀 --- SNERAL PLATFORM QUALITY CHECK --- 🚀');

    try {
        // 1. User & Auth
        const userCount = await prisma.user.count();
        const partnerCount = await prisma.servicePartner.count();
        const businessPartnerCount = await prisma.businessPartner.count();
        console.log(`\n👥 USERS & PARTNERS`);
        console.log(`- Total Users: ${userCount}`);
        console.log(`- Service Partners: ${partnerCount}`);
        console.log(`- Business Partners: ${businessPartnerCount}`);

        // 2. Services & Categories
        const categoryCount = await prisma.category.count();
        const serviceCount = await prisma.service.count();
        const activeServiceCount = await prisma.service.count({ where: { is_active: true } });
        console.log(`\n🛠️ SERVICES & CATEGORIES`);
        console.log(`- Total Categories: ${categoryCount}`);
        console.log(`- Total Services: ${serviceCount}`);
        console.log(`- Active Services: ${activeServiceCount}`);

        // 3. Location Hierarchy
        const stateCount = await prisma.state.count({ where: { is_active: true } });
        const districtCount = await prisma.district.count({ where: { is_active: true } });
        const areaCount = await prisma.area.count({ where: { is_active: true } });
        console.log(`\n📍 LOCATION HIERARCHY (Active)`);
        console.log(`- States: ${stateCount}`);
        console.log(`- Districts: ${districtCount}`);
        console.log(`- Areas: ${areaCount}`);

        // 4. Service Pricing Check
        const pricingCount = await prisma.serviceLocationPricing.count({ where: { is_active: true } });
        console.log(`\n💰 SERVICE PRICING`);
        console.log(`- Active Location-Specific Prices: ${pricingCount}`);

        const districtsWithServices = await prisma.district.findMany({
            where: { is_active: true, service_pricing: { some: { is_active: true } } },
            select: { name: true, _count: { select: { service_pricing: true } } }
        });
        console.log(`- Districts with active services: ${districtsWithServices.length}`);
        districtsWithServices.forEach(d => {
            console.log(`  • ${d.name} (${d._count.service_pricing} services)`);
        });

        // 5. Bookings & Transactions
        const bookingsCount = await prisma.booking.count();
        const completedBookings = await prisma.booking.count({ where: { status: 'COMPLETED' } });
        console.log(`\n📑 BOOKINGS`);
        console.log(`- Total Bookings: ${bookingsCount}`);
        console.log(`- Completed: ${completedBookings}`);

        // 6. Wallet Check
        const totalWallets = await prisma.wallet.count();
        const pendingPayouts = await prisma.withdrawalRequest.count({ where: { status: 'PENDING' } });
        console.log(`\n💳 WALLET & PAYOUTS`);
        console.log(`- Total Wallets: ${totalWallets}`);
        console.log(`- Pending Payout Requests: ${pendingPayouts}`);

        // 7. KYC Check
        const pendingPartnerKyc = await prisma.servicePartner.count({ where: { kyc_status: 'PENDING' } });
        const pendingBusinessKyc = await prisma.businessPartner.count({ where: { kyc_status: 'PENDING' } });
        const totalKycDocs = await prisma.kycDocument.count();
        const kycDocsByStatus = await prisma.kycDocument.groupBy({ by: ['status'], _count: true });

        console.log(`\n📑 KYC STATUS`);
        console.log(`- Pending Partner KYC: ${pendingPartnerKyc}`);
        console.log(`- Pending Business KYC: ${pendingBusinessKyc}`);
        console.log(`- Total KYC Documents: ${totalKycDocs}`);
        kycDocsByStatus.forEach(s => {
            console.log(`  • ${s.status}: ${s._count}`);
        });

    } catch (error) {
        console.error('❌ Data Check Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runCheck();
