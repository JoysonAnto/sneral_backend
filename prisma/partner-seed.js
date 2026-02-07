// Comprehensive seed for Business Partners and Service Partners
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting comprehensive partner seed...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. CREATE BUSINESS PARTNERS
    console.log('🏢 Creating Business Partners...\n');

    const bp1User = await prisma.user.upsert({
        where: { email: 'bp1@snearal.com' },
        update: {},
        create: {
            email: 'bp1@snearal.com',
            password: hashedPassword,
            full_name: 'Urban Services Company',
            phone_number: '+919001001001',
            role: 'BUSINESS_PARTNER',
            email_verified: true,
            phone_verified: true,
        }
    });

    const bp1 = await prisma.businessPartner.upsert({
        where: { user_id: bp1User.id },
        update: {},
        create: {
            user_id: bp1User.id,
            business_name: 'Urban Services Pvt Ltd',
            business_type: 'COMPANY',
            business_license: 'LIC001',
            gst_number: 'GST29AABC1234D1Z5',
            kyc_status: 'APPROVED',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560001',
            address: '123 MG Road, Bangalore',
            commission_rate: 0.10,
            team_management_enabled: true,
        }
    });
    console.log('✅ Created Business Partner: Urban Services Company');

    const bp2User = await prisma.user.upsert({
        where: { email: 'bp2@snearal.com' },
        update: {},
        create: {
            email: 'bp2@snearal.com',
            password: hashedPassword,
            full_name: 'Premium Home Solutions',
            phone_number: '+919001001002',
            role: 'BUSINESS_PARTNER',
            email_verified: true,
            phone_verified: true,
        }
    });

    const bp2 = await prisma.businessPartner.upsert({
        where: { user_id: bp2User.id },
        update: {},
        create: {
            user_id: bp2User.id,
            business_name: 'Premium Home Solutions Ltd',
            business_type: 'COMPANY',
            business_license: 'LIC002',
            gst_number: 'GST29AABC5678D1Z5',
            kyc_status: 'APPROVED',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560002',
            address: '456 Brigade Road, Bangalore',
            commission_rate: 0.12,
            team_management_enabled: true,
        }
    });
    console.log('✅ Created Business Partner: Premium Home Solutions');

    // 2. CREATE SERVICE PARTNERS (Independent)
    console.log('\n👷 Creating Independent Service Partners...\n');

    const sp1User = await prisma.user.upsert({
        where: { email: 'sp1@snearal.com' },
        update: {},
        create: {
            email: 'sp1@snearal.com',
            password: hashedPassword,
            full_name: 'Rajesh Kumar',
            phone_number: '+919002002001',
            role: 'SERVICE_PARTNER',
            email_verified: true,
            phone_verified: true,
        }
    });

    const sp1 = await prisma.servicePartner.upsert({
        where: { user_id: sp1User.id },
        update: {},
        create: {
            user_id: sp1User.id,
            availability_status: 'AVAILABLE',
            service_radius: 10,
            kyc_status: 'APPROVED',
        }
    });
    console.log('✅ Created Service Partner: Rajesh Kumar (Independent)');

    const sp2User = await prisma.user.upsert({
        where: { email: 'sp2@snearal.com' },
        update: {},
        create: {
            email: 'sp2@snearal.com',
            password: hashedPassword,
            full_name: 'Amit Sharma',
            phone_number: '+919002002002',
            role: 'SERVICE_PARTNER',
            email_verified: true,
            phone_verified: true,
        }
    });

    const sp2 = await prisma.servicePartner.upsert({
        where: { user_id: sp2User.id },
        update: {},
        create: {
            user_id: sp2User.id,
            availability_status: 'AVAILABLE',
            service_radius: 15,
            kyc_status: 'APPROVED',
        }
    });
    console.log('✅ Created Service Partner: Amit Sharma (Independent)');

    // 3. CREATE SERVICE PARTNERS UNDER BUSINESS PARTNERS
    console.log('\n👥 Creating Service Partners under Business Partners...\n');

    const sp3User = await prisma.user.upsert({
        where: { email: 'sp3@snearal.com' },
        update: {},
        create: {
            email: 'sp3@snearal.com',
            password: hashedPassword,
            full_name: 'Suresh Reddy',
            phone_number: '+919002002003',
            role: 'SERVICE_PARTNER',
            email_verified: true,
            phone_verified: true,
        }
    });

    const sp3 = await prisma.servicePartner.upsert({
        where: { user_id: sp3User.id },
        update: {},
        create: {
            user_id: sp3User.id,
            business_partner_id: bp1.id,
            availability_status: 'AVAILABLE',
            service_radius: 12,
            kyc_status: 'APPROVED',
        }
    });
    console.log('✅ Created Service Partner: Suresh Reddy (Under Urban Services)');

    const sp4User = await prisma.user.upsert({
        where: { email: 'sp4@snearal.com' },
        update: {},
        create: {
            email: 'sp4@snearal.com',
            password: hashedPassword,
            full_name: 'Prakash Rao',
            phone_number: '+919002002004',
            role: 'SERVICE_PARTNER',
            email_verified: true,
            phone_verified: true,
        }
    });

    const sp4 = await prisma.servicePartner.upsert({
        where: { user_id: sp4User.id },
        update: {},
        create: {
            user_id: sp4User.id,
            business_partner_id: bp1.id,
            availability_status: 'AVAILABLE',
            service_radius: 8,
            kyc_status: 'APPROVED',
        }
    });
    console.log('✅ Created Service Partner: Prakash Rao (Under Urban Services)');

    const sp5User = await prisma.user.upsert({
        where: { email: 'sp5@snearal.com' },
        update: {},
        create: {
            email: 'sp5@snearal.com',
            password: hashedPassword,
            full_name: 'Vikram Singh',
            phone_number: '+919002002005',
            role: 'SERVICE_PARTNER',
            email_verified: true,
            phone_verified: true,
        }
    });

    const sp5 = await prisma.servicePartner.upsert({
        where: { user_id: sp5User.id },
        update: {},
        create: {
            user_id: sp5User.id,
            business_partner_id: bp2.id,
            availability_status: 'AVAILABLE',
            service_radius: 10,
            kyc_status: 'APPROVED',
        }
    });
    console.log('✅ Created Service Partner: Vikram Singh (Under Premium Home Solutions)');

    // 4. ENSURE SERVICES EXIST
    console.log('\n🔧 Ensuring services exist...\n');

    const serviceCount = await prisma.service.count();
    console.log(`Found ${serviceCount} existing services`);

    if (serviceCount === 0) {
        console.log('Creating services...');

        await prisma.service.createMany({
            data: [
                {
                    name: 'Deep Home Cleaning',
                    description: 'Comprehensive deep cleaning service',
                    category: 'CLEANING',
                    base_price: 1500,
                    duration_minutes: 180,
                    is_active: true,
                },
                {
                    name: 'AC Service & Repair',
                    description: 'Complete AC servicing',
                    category: 'APPLIANCE_REPAIR',
                    base_price: 800,
                    duration_minutes: 90,
                    is_active: true,
                },
                {
                    name: 'Plumbing Repair',
                    description: 'Fix leaks and plumbing issues',
                    category: 'PLUMBING',
                    base_price: 600,
                    duration_minutes: 75,
                    is_active: true,
                },
            ]
        });
        console.log('✅ Created 3 services');
    }

    // 5. SUMMARY
    console.log('\n📊 SEED SUMMARY');
    console.log('===============');
    console.log(`Business Partners: ${await prisma.businessPartner.count()}`);
    console.log(`Service Partners: ${await prisma.servicePartner.count()}`);
    console.log(`Services: ${await prisma.service.count()}`);
    console.log(`Users: ${await prisma.user.count()}`);
    console.log('\n✅ Seeding completed successfully!\n');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
