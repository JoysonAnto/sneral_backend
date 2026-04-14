import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UC_SERVICES = [
    {
        categoryName: 'Home Cleaning',
        name: 'Sofa Cleaning',
        description: 'Professional sofa and upholstery cleaning with advanced steam cleaning technology. Removes stains and allergens.',
        base_price: 799,
        duration: 90,
        locations: [
            { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 499 },
            { districtName: 'Tiruppur', price: 599 },
            { stateName: 'Tamil Nadu', price: 699 }
        ]
    },
    {
        categoryName: 'Appliance Repair',
        name: 'AC Servicing',
        description: 'Complete air conditioner cleaning, gas refill, and servicing for all brands. Includes filter cleaning.',
        base_price: 999,
        duration: 120,
        locations: [
            { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 599 },
            { districtName: 'Tiruppur', price: 699 },
            { stateName: 'Tamil Nadu', price: 799 }
        ]
    },
    {
        categoryName: 'Plumbing',
        name: 'Bathroom Plumbing',
        description: 'Complete bathroom plumbing installation and repair including toilets, sinks, showers, and drainage.',
        base_price: 3499,
        duration: 300,
        locations: [
            { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 2499 },
            { districtName: 'Tiruppur', price: 2799 },
            { stateName: 'Tamil Nadu', price: 2999 }
        ]
    },
    {
        categoryName: 'Carpentry',
        name: 'Furniture Assembly',
        description: 'Professional assembly of flat-pack furniture from IKEA, Amazon, and other brands. Quick and hassle-free.',
        base_price: 699,
        duration: 120,
        locations: [
            { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 399 },
            { districtName: 'Tiruppur', price: 499 },
            { stateName: 'Tamil Nadu', price: 549 }
        ]
    },
    {
        categoryName: 'Painting',
        name: 'Room Painting',
        description: 'Professional interior painting for single room with premium quality Asian Paints. Includes wall preparation.',
        base_price: 4999,
        duration: 480,
        locations: [
            { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 3499 },
            { districtName: 'Tiruppur', price: 3999 },
            { stateName: 'Tamil Nadu', price: 4499 }
        ]
    },
    // Adding more specific UC items
    {
        categoryName: 'Home Cleaning',
        name: 'Sofa Spa (per seat)',
        description: 'Detailed cleaning and vacuuming of individual sofa seats to restore freshness.',
        base_price: 249,
        duration: 30,
        locations: [
            { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 149 },
            { districtName: 'Tiruppur', price: 179 },
            { stateName: 'Tamil Nadu', price: 199 }
        ]
    },
    {
        categoryName: 'Home Cleaning',
        name: 'Move-in Deep Cleaning',
        description: 'Special deep cleaning for empty homes before you move in. Focus on cupboards and floors.',
        base_price: 3999,
        duration: 480,
        locations: [
            { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 2999 },
            { districtName: 'Tiruppur', price: 3299 },
            { stateName: 'Tamil Nadu', price: 3499 }
        ]
    }
];

async function seedUC() {
    console.log('🌱 Starting Urban Company style pricing seed...');

    const categories = await prisma.category.findMany();
    const state = await prisma.state.findFirst({ where: { name: 'Tamil Nadu' } });
    const district = await prisma.district.findFirst({ where: { name: 'Tiruppur', state_id: state?.id } });
    const area = await prisma.area.findFirst({ where: { name: 'Dharapuram', district_id: district?.id } });

    if (!state || !district || !area) {
        console.error('❌ Required locations (Tamil Nadu/Tiruppur/Dharapuram) not found in DB.');
        return;
    }

    for (const ucSvc of UC_SERVICES) {
        const cat = categories.find(c => c.name === ucSvc.categoryName);
        if (!cat) {
            console.log(`⚠️ Category ${ucSvc.categoryName} not found, skipping service ${ucSvc.name}`);
            continue;
        }

        // 1. Upsert Service
        const service = await prisma.service.upsert({
            where: { 
                // We don't have a unique constraint on name yet, but we'll use findFirst/upsert logic
                id: (await prisma.service.findFirst({ where: { name: ucSvc.name, category_id: cat.id } }))?.id || '00000000-0000-0000-0000-000000000000'
            },
            update: {
                description: ucSvc.description,
                base_price: ucSvc.base_price,
                duration: ucSvc.duration,
                is_active: true
            },
            create: {
                category_id: cat.id,
                name: ucSvc.name,
                description: ucSvc.description,
                base_price: ucSvc.base_price,
                duration: ucSvc.duration,
                is_active: true
            }
        });

        console.log(`✅ Synced service: ${service.name}`);

        // 2. Add Location Pricing
        for (const loc of ucSvc.locations) {
            let targetStateId = state.id;
            let targetDistrictId = null;
            let targetAreaId = null;

            if (loc.districtName) {
                targetDistrictId = district.id;
            }
            if (loc.areaName) {
                targetAreaId = area.id;
            }

            // Simple state pricing if no district/area specified in loc object
            // Actually the loc objects are structured:
            // { areaName: 'Dharapuram', districtName: 'Tiruppur', price: 349 }
            // { districtName: 'Tiruppur', price: 399 }
            // { stateName: 'Tamil Nadu', price: 449 }

            await prisma.serviceLocationPricing.upsert({
                where: {
                    service_id_state_id_district_id_area_id: {
                        service_id: service.id,
                        state_id: targetStateId,
                        district_id: targetDistrictId as any,
                        area_id: targetAreaId as any
                    }
                },
                update: {
                    price: loc.price,
                    is_active: true
                },
                create: {
                    service_id: service.id,
                    state_id: targetStateId,
                    district_id: targetDistrictId,
                    area_id: targetAreaId,
                    price: loc.price,
                    is_active: true
                }
            }).catch(async () => {
                // If the compound unique constraint has issues with nulls (Prisma version dependent)
                // We'll perform a manual update or create
                console.log(`   ℹ️ Retrying location price for ${service.name} at ${loc.areaName || loc.districtName || 'State'}`);
                try {
                   const existing = await prisma.serviceLocationPricing.findFirst({
                       where: {
                           service_id: service.id,
                           state_id: targetStateId,
                           district_id: targetDistrictId,
                           area_id: targetAreaId
                       }
                   });
                   if (existing) {
                       await prisma.serviceLocationPricing.update({
                           where: { id: existing.id },
                           data: { price: loc.price }
                       });
                   } else {
                       await prisma.serviceLocationPricing.create({
                           data: {
                               service_id: service.id,
                               state_id: targetStateId,
                               district_id: targetDistrictId,
                               area_id: targetAreaId,
                               price: loc.price,
                               is_active: true
                           }
                       });
                   }
                } catch(innerErr) {
                    console.error(`   ❌ Failed to set pricing for ${service.name}:`, innerErr);
                }
            });
        }
    }

    console.log('\n✨ Urban Company style pricing seeded successfully!');
    await prisma.$disconnect();
}

seedUC().catch(e => {
    console.error(e);
    process.exit(1);
});
