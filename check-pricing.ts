import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const pricingCount = await prisma.serviceLocationPricing.count({
        where: { is_active: true }
    });
    console.log('Active Pricing Records:', pricingCount);

    const districtsWithPricing = await prisma.district.findMany({
        where: {
            service_pricing: {
                some: { is_active: true }
            }
        },
        select: { name: true }
    });
    console.log('Districts with active pricing:', districtsWithPricing.map(d => d.name));

    await prisma.$disconnect();
}

check();
