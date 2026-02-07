const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addServicePartners() {
    console.log('\n👷 Adding Service Partners...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Get categories
    const categories = await prisma.category.findMany();

    if (categories.length === 0) {
        console.error('❌ No categories found. Please run seed script first.');
        await prisma.$disconnect();
        return;
    }

    // Get business partner
    const businessPartner = await prisma.businessPartner.findFirst({
        where: { user: { email: 'homecare@business.com' } }
    });

    const servicePartners = [
        {
            name: 'Ramesh Kumar',
            email: 'ramesh.electrician@service.com',
            phone: '+919876543220',
            category: 'Electrical Services',
            location: { lat: 12.9716, lon: 77.5946 }, // Bangalore center
            skills: 'Electrical installations, repairs, wiring'
        },
        {
            name: 'Suresh Patel',
            email: 'suresh.plumber@service.com',
            phone: '+919876543221',
            category: 'Plumbing',
            location: { lat: 12.9352, lon: 77.6245 }, // Koramangala
            skills: 'Plumbing, pipe fitting, bathroom installations'
        },
        {
            name: 'Deepak Singh',
            email: 'deepak.cleaner@service.com',
            phone: '+919876543222',
            category: 'Home Cleaning',
            location: { lat: 12.9698, lon: 77.7500 }, // Whitefield
            skills: 'Deep cleaning, sofa cleaning, home sanitization'
        },
        {
            name: 'Kumar Reddy',
            email: 'kumar.carpenter@service.com',
            phone: '+919876543223',
            category: 'Carpentry',
            location: { lat: 12.9784, lon: 77.6408 }, // Indiranagar
            skills: 'Furniture assembly, woodwork, custom carpentry'
        },
        {
            name: 'Vijay AC Tech',
            email: 'vijay.ac@service.com',
            phone: '+919876543224',
            category: 'Appliance Repair',
            location: { lat: 12.9116, lon: 77.6382 }, // HSR Layout
            skills: 'AC servicing, washing machine repair, appliance maintenance'
        },
    ];

    let created = 0;

    for (const sp of servicePartners) {
        // Check if already exists
        const existing = await prisma.user.findUnique({
            where: { email: sp.email }
        });

        if (existing) {
            console.log(`⚠️  ${sp.name} already exists`);
            continue;
        }

        // Find matching category
        const category = categories.find(c => c.name === sp.category);

        if (!category) {
            console.log(`⚠️  Category not found for ${sp.name}: ${sp.category}`);
            continue;
        }

        try {
            // Create user
            const user = await prisma.user.create({
                data: {
                    email: sp.email,
                    password: hashedPassword,
                    full_name: sp.name,
                    phone_number: sp.phone,
                    role: 'SERVICE_PARTNER',
                    email_verified: true,
                    phone_verified: true,
                },
            });

            // Create profile
            await prisma.profile.create({
                data: {
                    user_id: user.id,
                    address: 'Bangalore, Karnataka',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    postal_code: '560001',
                    country: 'India',
                },
            });

            // Create wallet
            await prisma.wallet.create({
                data: {
                    user_id: user.id,
                    balance: 0,
                },
            });

            // Create service partner record
            await prisma.servicePartner.create({
                data: {
                    user_id: user.id,
                    business_partner_id: businessPartner?.id || null,
                    category_id: category.id,
                    availability_status: 'AVAILABLE',
                    kyc_status: 'APPROVED',
                    kyc_verified_at: new Date(),
                    service_radius: 10, // 10km radius
                    current_latitude: sp.location.lat,
                    current_longitude: sp.location.lon,
                    rating: 4.5 + Math.random() * 0.5, // Random rating 4.5-5.0
                    total_jobs_completed: Math.floor(Math.random() * 100) + 50,
                    skills: sp.skills,
                    experience_years: 5 + Math.floor(Math.random() * 10),
                },
            });

            console.log(`✅ Created: ${sp.name} (${sp.category})`);
            created++;

        } catch (error) {
            console.error(`❌ Failed to create ${sp.name}:`, error.message);
        }
    }

    console.log(`\n✅ Successfully created ${created} service partners!\n`);
    console.log('📧 Login credentials (Password: password123):');
    servicePartners.forEach(sp => {
        console.log(`   ${sp.email}`);
    });
    console.log('');

    await prisma.$disconnect();
}

addServicePartners().catch(console.error);
