const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log('🛠️ Fixing Service Partner Mappings...\n');

    try {
        const categories = await prisma.category.findMany();
        const servicePartners = [
            { email: 'ramesh.electrician@service.com', category: 'Electrical Services' },
            { email: 'suresh.plumber@service.com', category: 'Plumbing' },
            { email: 'deepak.cleaner@service.com', category: 'Home Cleaning' },
            { email: 'kumar.carpenter@service.com', category: 'Carpentry' },
            { email: 'vijay.ac@service.com', category: 'Appliance Repair' },
        ];

        for (const sp of servicePartners) {
            const user = await prisma.user.findUnique({ where: { email: sp.email } });
            if (!user) {
                console.log(`❌ User not found: ${sp.email}`);
                continue;
            }

            const category = categories.find(c => c.name === sp.category);
            if (!category) {
                console.log(`❌ Category not found: ${sp.category}`);
                continue;
            }

            const existingPartner = await prisma.servicePartner.findUnique({ where: { user_id: user.id } });
            if (existingPartner) {
                console.log(`✅ ${sp.email} already has a ServicePartner record.`);
                continue;
            }

            // Create service partner record
            await prisma.servicePartner.create({
                data: {
                    user_id: user.id,
                    category_id: category.id,
                    availability_status: 'AVAILABLE',
                    kyc_status: 'APPROVED',
                    kyc_verified_at: new Date(),
                    service_radius: 10,
                    current_latitude: 12.9716, // Default to Bangalore
                    current_longitude: 77.5946,
                    avg_rating: 4.8,
                    total_ratings: 1,
                    total_bookings: 10,
                    completed_bookings: 10,
                },
            });
            console.log(`✅ Created ServicePartner for ${sp.email}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fix();
