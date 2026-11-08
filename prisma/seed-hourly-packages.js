const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedHourlyPackages() {
    console.log('📦 Seeding Hourly Service Packages (1h, 3h, 5h, 8h)...');

    // Fetch all active services
    const services = await prisma.service.findMany({
        where: { is_active: true },
        include: { packages: true }
    });

    console.log(`Found ${services.length} active services.`);

    for (const service of services) {
        // If service doesn't have packages, create standard hourly package tier
        if (service.packages.length === 0) {
            // Determine 1-hour rate: default to ₹219 or service.base_price
            const base1Hr = service.base_price > 0 ? service.base_price : 219;

            // Calculate standard progressive packages:
            // 1h: base1Hr (e.g. 219)
            // 3h: ~16% discount (e.g. 550 for 219 base)
            // 5h: ~22% discount (e.g. 850 for 219 base)
            // 8h: ~37% discount (e.g. 1100 for 219 base)
            const ratio = base1Hr / 219;
            const price1h = Math.round(base1Hr);
            const price3h = Math.round(550 * ratio);
            const price5h = Math.round(850 * ratio);
            const price8h = Math.round(1100 * ratio);

            const packagesToCreate = [
                {
                    service_id: service.id,
                    hours: 1,
                    title: '1 Hour',
                    price: price1h,
                    original_price: price1h,
                    is_popular: false,
                    display_order: 1
                },
                {
                    service_id: service.id,
                    hours: 3,
                    title: '3 Hours',
                    price: price3h,
                    original_price: Math.round(3 * price1h),
                    is_popular: true,
                    display_order: 2
                },
                {
                    service_id: service.id,
                    hours: 5,
                    title: '5 Hours',
                    price: price5h,
                    original_price: Math.round(5 * price1h),
                    is_popular: false,
                    display_order: 3
                },
                {
                    service_id: service.id,
                    hours: 8,
                    title: '8 Hours',
                    price: price8h,
                    original_price: Math.round(8 * price1h),
                    is_popular: false,
                    display_order: 4
                }
            ];

            await prisma.servicePackage.createMany({
                data: packagesToCreate
            });

            console.log(`  ✅ Added 4 hourly packages for: ${service.name} (1h: ₹${price1h}, 3h: ₹${price3h}, 5h: ₹${price5h}, 8h: ₹${price8h})`);
        } else {
            console.log(`  ℹ️  ${service.name} already has ${service.packages.length} packages.`);
        }
    }

    console.log('✨ Hourly Service Packages seeded successfully!');
}

seedHourlyPackages()
    .catch(e => {
        console.error('Error seeding packages:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

