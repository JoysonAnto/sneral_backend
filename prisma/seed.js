// Enhanced seed script with location-based pricing for Chennai and Bangalore
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Professional images from Unsplash
const SERVICE_IMAGES = {
    deepCleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
    sofaCleaning: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
    fanInstall: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800',
    lightInstall: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800',
    tapRepair: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800',
    bathPlumbing: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800',
    furniture: 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?w=800',
    acService: 'https://images.unsplash.com/photo-1631545806609-7a8b0c3d9ff8?w=800',
    washingMachine: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800',
    painting: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800',
};

const CATEGORY_ICONS = {
    cleaning: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400',
    electrical: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400',
    plumbing: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=400',
    carpentry: 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?w=400',
    appliance: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400',
    painting: 'https://images.unsplash.com/photo-1562259929-1466b75da184?w=400',
};

async function main() {
    console.log('🌱 Starting enhanced database seed with location-based pricing...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // ============== LOCATION HIERARCHY ==============
    console.log('🗺️  Creating states...');

    const karnataka = await prisma.state.create({
        data: {
            name: 'Karnataka',
            code: 'KA',
            latitude: 15.3173,
            longitude: 75.7139,
            is_active: true,
        },
    });

    const tamilNadu = await prisma.state.create({
        data: {
            name: 'Tamil Nadu',
            code: 'TN',
            latitude: 11.1271,
            longitude: 78.6569,
            is_active: true,
        },
    });

    console.log('🏙️  Creating districts...');

    const bangaloreUrban = await prisma.district.create({
        data: {
            name: 'Bangalore Urban',
            state_id: karnataka.id,
            latitude: 12.9716,
            longitude: 77.5946,
            is_active: true,
        },
    });

    const chennai = await prisma.district.create({
        data: {
            name: 'Chennai',
            state_id: tamilNadu.id,
            latitude: 13.0827,
            longitude: 80.2707,
            is_active: true,
        },
    });

    console.log('📍 Creating areas...');

    // Bangalore Areas
    const bangaloreAreas = await Promise.all([
        prisma.area.create({
            data: {
                name: 'Koramangala',
                district_id: bangaloreUrban.id,
                pincode: '560034',
                latitude: 12.9352,
                longitude: 77.6245,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'Whitefield',
                district_id: bangaloreUrban.id,
                pincode: '560066',
                latitude: 12.9698,
                longitude: 77.7500,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'Indiranagar',
                district_id: bangaloreUrban.id,
                pincode: '560038',
                latitude: 12.9784,
                longitude: 77.6408,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'HSR Layout',
                district_id: bangaloreUrban.id,
                pincode: '560102',
                latitude: 12.9116,
                longitude: 77.6382,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'Electronic City',
                district_id: bangaloreUrban.id,
                pincode: '560100',
                latitude: 12.8456,
                longitude: 77.6603,
                is_active: true,
            },
        }),
    ]);

    // Chennai Areas
    const chennaiAreas = await Promise.all([
        prisma.area.create({
            data: {
                name: 'T Nagar',
                district_id: chennai.id,
                pincode: '600017',
                latitude: 13.0418,
                longitude: 80.2341,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'Anna Nagar',
                district_id: chennai.id,
                pincode: '600040',
                latitude: 13.0878,
                longitude: 80.2085,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'Velachery',
                district_id: chennai.id,
                pincode: '600042',
                latitude: 12.9750,
                longitude: 80.2212,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'Adyar',
                district_id: chennai.id,
                pincode: '600020',
                latitude: 13.0067,
                longitude: 80.2582,
                is_active: true,
            },
        }),
        prisma.area.create({
            data: {
                name: 'OMR',
                district_id: chennai.id,
                pincode: '600096',
                latitude: 12.8688,
                longitude: 80.2204,
                is_active: true,
            },
        }),
    ]);

    // ============== CUSTOMERS ==============
    console.log('👨‍👩‍👧 Creating customers...');

    // Bangalore Customers
    const customer1 = await prisma.user.create({
        data: {
            email: 'rajesh.kumar@gmail.com',
            password: hashedPassword,
            full_name: 'Rajesh Kumar',
            phone_number: '+919876543212',
            role: 'CUSTOMER',
            email_verified: true,
            phone_verified: true,
        },
    });
    await prisma.profile.create({
        data: {
            user_id: customer1.id,
            address: '101 Green Park, Koramangala',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560034',
            country: 'India',
            latitude: bangaloreAreas[0].latitude,
            longitude: bangaloreAreas[0].longitude,
        },
    });
    await prisma.wallet.create({
        data: { user_id: customer1.id, balance: 5000 },
    });

    const customer2 = await prisma.user.create({
        data: {
            email: 'priya.sharma@gmail.com',
            password: hashedPassword,
            full_name: 'Priya Sharma',
            phone_number: '+919876543213',
            role: 'CUSTOMER',
            email_verified: true,
            phone_verified: true,
        },
    });
    await prisma.profile.create({
        data: {
            user_id: customer2.id,
            address: '202 Prestige Heights, Whitefield',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560066',
            country: 'India',
            latitude: bangaloreAreas[1].latitude,
            longitude: bangaloreAreas[1].longitude,
        },
    });
    await prisma.wallet.create({
        data: { user_id: customer2.id, balance: 3500 },
    });

    // Chennai Customers
    const customer3 = await prisma.user.create({
        data: {
            email: 'amit.patel@yahoo.com',
            password: hashedPassword,
            full_name: 'Amit Patel',
            phone_number: '+919876543214',
            role: 'CUSTOMER',
            email_verified: true,
            phone_verified: true,
        },
    });
    await prisma.profile.create({
        data: {
            user_id: customer3.id,
            address: '303 Nungambakkam High Road, T Nagar',
            city: 'Chennai',
            state: 'Tamil Nadu',
            postal_code: '600017',
            country: 'India',
            latitude: chennaiAreas[0].latitude,
            longitude: chennaiAreas[0].longitude,
        },
    });
    await prisma.wallet.create({
        data: { user_id: customer3.id, balance: 7500 },
    });

    const customer4 = await prisma.user.create({
        data: {
            email: 'sneha.reddy@outlook.com',
            password: hashedPassword,
            full_name: 'Sneha Reddy',
            phone_number: '+919876543215',
            role: 'CUSTOMER',
            email_verified: true,
            phone_verified: true,
        },
    });
    await prisma.profile.create({
        data: {
            user_id: customer4.id,
            address: '404 Anna Nagar West',
            city: 'Chennai',
            state: 'Tamil Nadu',
            postal_code: '600040',
            country: 'India',
            latitude: chennaiAreas[1].latitude,
            longitude: chennaiAreas[1].longitude,
        },
    });
    await prisma.wallet.create({
        data: { user_id: customer4.id, balance: 2000 },
    });

    const customer5 = await prisma.user.create({
        data: {
            email: 'vikram.singh@gmail.com',
            password: hashedPassword,
            full_name: 'Vikram Singh',
            phone_number: '+919876543216',
            role: 'CUSTOMER',
            email_verified: true,
            phone_verified: true,
        },
    });
    await prisma.profile.create({
        data: {
            user_id: customer5.id,
            address: '505 Velachery Main Road',
            city: 'Chennai',
            state: 'Tamil Nadu',
            postal_code: '600042',
            country: 'India',
            latitude: chennaiAreas[2].latitude,
            longitude: chennaiAreas[2].longitude,
        },
    });
    await prisma.wallet.create({
        data: { user_id: customer5.id, balance: 10000 },
    });

    // ============== CATEGORIES ==============
    console.log('📂 Creating categories with icons...');

    const cat1 = await prisma.category.create({
        data: {
            name: 'Home Cleaning',
            description: 'Professional home cleaning services',
            icon_url: CATEGORY_ICONS.cleaning,
            is_active: true,
            display_order: 1,
        },
    });

    const cat2 = await prisma.category.create({
        data: {
            name: 'Electrical Services',
            description: 'Expert electrical services',
            icon_url: CATEGORY_ICONS.electrical,
            is_active: true,
            display_order: 2,
        },
    });

    const cat3 = await prisma.category.create({
        data: {
            name: 'Plumbing',
            description: 'Plumbing services',
            icon_url: CATEGORY_ICONS.plumbing,
            is_active: true,
            display_order: 3,
        },
    });

    const cat4 = await prisma.category.create({
        data: {
            name: 'Carpentry',
            description: 'Carpentry services',
            icon_url: CATEGORY_ICONS.carpentry,
            is_active: true,
            display_order: 4,
        },
    });

    const cat5 = await prisma.category.create({
        data: {
            name: 'Appliance Repair',
            description: 'Appliance repair services',
            icon_url: CATEGORY_ICONS.appliance,
            is_active: true,
            display_order: 5,
        },
    });

    const cat6 = await prisma.category.create({
        data: {
            name: 'Painting',
            description: 'Painting services',
            icon_url: CATEGORY_ICONS.painting,
            is_active: true,
            display_order: 6,
        },
    });

    // ============== SERVICES ==============
    console.log('⚙️  Creating services with professional images...');

    const services = [];

    const serviceData = [
        { cat: cat1, name: 'Deep Home Cleaning', desc: 'Complete deep cleaning of entire home', price: 1999, duration: 240, img: SERVICE_IMAGES.deepCleaning },
        { cat: cat1, name: 'Sofa Cleaning', desc: 'Professional sofa cleaning', price: 599, duration: 90, img: SERVICE_IMAGES.sofaCleaning },
        { cat: cat2, name: 'Fan Installation & Repair', desc: 'Installation and repair of ceiling fans', price: 299, duration: 60, img: SERVICE_IMAGES.fanInstall },
        { cat: cat2, name: 'Light Fixture Installation', desc: 'Installation of lights and fixtures', price: 399, duration: 90, img: SERVICE_IMAGES.lightInstall },
        { cat: cat3, name: 'Tap/Faucet Repair', desc: 'Repair of leaking taps', price: 249, duration: 45, img: SERVICE_IMAGES.tapRepair },
        { cat: cat3, name: 'Bathroom Plumbing', desc: 'Complete bathroom plumbing', price: 2999, duration: 300, img: SERVICE_IMAGES.bathPlumbing },
        { cat: cat4, name: 'Furniture Assembly', desc: 'Assembly of flat-pack furniture', price: 499, duration: 120, img: SERVICE_IMAGES.furniture },
        { cat: cat5, name: 'AC Servicing', desc: 'AC cleaning and servicing', price: 799, duration: 120, img: SERVICE_IMAGES.acService },
        { cat: cat5, name: 'Washing Machine Repair', desc: 'Washing machine repair', price: 599, duration: 90, img: SERVICE_IMAGES.washingMachine },
        { cat: cat6, name: 'Room Painting', desc: 'Interior painting for single room', price: 3999, duration: 480, img: SERVICE_IMAGES.painting },
    ];

    for (const svc of serviceData) {
        const service = await prisma.service.create({
            data: {
                category_id: svc.cat.id,
                name: svc.name,
                description: svc.desc,
                base_price: svc.price,
                duration: svc.duration,
                image_url: svc.img,
                is_active: true,
            },
        });
        services.push(service);
    }

    // ============== LOCATION-BASED PRICING ==============
    console.log('💰 Creating location-based pricing...');
    console.log('   📍 Bangalore: Base prices (Metro premium)');
    console.log('   📍 Chennai: 15% discount (Tier-2 pricing)');

    for (const service of services) {
        // Karnataka/Bangalore pricing (base price)
        await prisma.serviceLocationPricing.create({
            data: {
                service_id: service.id,
                state_id: karnataka.id,
                district_id: bangaloreUrban.id,
                price: service.base_price,
                is_active: true,
            },
        });

        // Tamil Nadu/Chennai pricing (15% discount)
        const chennaiPrice = Math.round(service.base_price * 0.85);
        await prisma.serviceLocationPricing.create({
            data: {
                service_id: service.id,
                state_id: tamilNadu.id,
                district_id: chennai.id,
                price: chennaiPrice,
                is_active: true,
            },
        });
    }

    console.log('\n✨ Database seeded successfully with location-based pricing!\n');
    console.log('📊 Summary:');
    console.log('  ✅ 2 States (Karnataka, Tamil Nadu)');
    console.log('  ✅ 2 Districts (Bangalore Urban, Chennai)');
    console.log('  ✅ 10 Areas (5 Bangalore + 5 Chennai)');
    console.log('  ✅ 5 Customers (2 Bangalore + 3 Chennai)');
    console.log('  ✅ 6 Categories with professional icons');
    console.log('  ✅ 10 Services with high-quality images');
    console.log('  ✅ 20 Location Pricing records (10 services × 2 cities)');
    console.log('\n💰 Pricing Strategy:');
    console.log('  • Bangalore: Premium metro pricing (base)');
    console.log('  • Chennai: 15% lower (tier-2 city)');
    console.log('\n🔐 Password for all: password123');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
