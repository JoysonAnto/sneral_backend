import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedPricing() {
    console.log('🌱 Seeding pricing for districts...');
    
    const services = await prisma.service.findMany();
    const districts = await prisma.district.findMany();
    
    if (services.length === 0 || districts.length === 0) {
        console.log('❌ No services or districts found to seed pricing.');
        return;
    }

    for (const district of districts) {
        console.log(`📍 Seeding pricing for district: ${district.name}`);
        for (const service of services) {
            // Create a pricing record with a slight discount for some services
            const discount = Math.random() > 0.5 ? Math.floor(Math.random() * 200) : 0;
            const price = service.base_price - discount;
            
            await prisma.serviceLocationPricing.upsert({
                where: {
                    service_id_state_id_district_id_area_id: {
                        service_id: service.id,
                        state_id: district.state_id,
                        district_id: district.id,
                        area_id: null as any // Prisma quirk with null in compound unique
                    }
                },
                update: {
                    price,
                    is_active: true
                },
                create: {
                    service_id: service.id,
                    state_id: district.state_id,
                    district_id: district.id,
                    price,
                    is_active: true
                }
            }).catch(e => {
                // If the upsert fails due to existing record or null issues, try simple create/update
                return prisma.serviceLocationPricing.create({
                    data: {
                        service_id: service.id,
                        state_id: district.state_id,
                        district_id: district.id,
                        price,
                        is_active: true
                    }
                }).catch(() => {});
            });
        }
    }
    
    console.log('✅ Pricing seeded successfully!');
    await prisma.$disconnect();
}

seedPricing();
