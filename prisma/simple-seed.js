// Simple seed script to populate services and service partners
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting simple database seed...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Check if data already exists
    const existingPartners = await prisma.servicePartner.count();
    const existingServices = await prisma.service.count();

    console.log(`Existing Partners: ${existingPartners}`);
    console.log(`Existing Services: ${existingServices}\n`);

    // 1. Create Service Partners
    console.log('👥 Creating service partners...');

    try {
        const partner1 = await prisma.servicePartner.upsert({
            where: { phone_number: '+919876543210' },
            update: {},
            create: {
                phone_number: '+919876543210',
                email_address: 'partner1@snearal.com',
                password_hash: hashedPassword,
                full_name: 'John Doe Services',
                status: 'APPROVED',
                is_verified: true,
                rating_avg: 4.8,
                rating_count: 45,
                business_details: {
                    create: {
                        business_name: 'John Doe Professional Services',
                        business_type: 'INDIVIDUAL',
                        registration_number: 'REG001',
                        address_line1: '123 Service Street',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        pincode: '560001',
                    }
                }
            }
        });
        console.log('✅ Created partner: John Doe Services');

        const partner2 = await prisma.servicePartner.upsert({
            where: { phone_number: '+919876543211' },
            update: {},
            create: {
                phone_number: '+919876543211',
                email_address: 'partner2@snearal.com',
                password_hash: hashedPassword,
                full_name: 'Premium Home Services',
                status: 'APPROVED',
                is_verified: true,
                rating_avg: 4.9,
                rating_count: 78,
                business_details: {
                    create: {
                        business_name: 'Premium Home Services Pvt Ltd',
                        business_type: 'COMPANY',
                        registration_number: 'REG002',
                        gst_number: 'GST002',
                        address_line1: '456 Commercial Road',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        pincode: '560002',
                    }
                }
            }
        });
        console.log('✅ Created partner: Premium Home Services');

        const partner3 = await prisma.servicePartner.upsert({
            where: { phone_number: '+919876543212' },
            update: {},
            create: {
                phone_number: '+919876543212',
                email_address: 'partner3@snearal.com',
                password_hash: hashedPassword,
                full_name: 'Quick Fix Solutions',
                status: 'APPROVED',
                is_verified: true,
                rating_avg: 4.7,
                rating_count: 32,
                business_details: {
                    create: {
                        business_name: 'Quick Fix Solutions',
                        business_type: 'INDIVIDUAL',
                        registration_number: 'REG003',
                        address_line1: '789 Service Lane',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        pincode: '560003',
                    }
                }
            }
        });
        console.log('✅ Created partner: Quick Fix Solutions');

        // 2. Create Services
        console.log('\n🔧 Creating services...');

        const service1 = await prisma.service.create({
            data: {
                name: 'Deep Home Cleaning',
                description: 'Comprehensive deep cleaning service for your entire home including all rooms, kitchen, and bathrooms',
                category: 'CLEANING',
                base_price: 1500,
                duration_minutes: 180,
                is_active: true,
                image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
            }
        });
        console.log('✅ Created service: Deep Home Cleaning');

        const service2 = await prisma.service.create({
            data: {
                name: 'AC Service & Repair',
                description: 'Complete AC servicing including gas refilling, filter cleaning, and general maintenance',
                category: 'APPLIANCE_REPAIR',
                base_price: 800,
                duration_minutes: 90,
                is_active: true,
                image_url: 'https://images.unsplash.com/photo-1631545806609-7a8b0c3d9ff8?w=800',
            }
        });
        console.log('✅ Created service: AC Service & Repair');

        const service3 = await prisma.service.create({
            data: {
                name: 'Ceiling Fan Installation',
                description: 'Professional ceiling fan installation with wiring and mounting',
                category: 'ELECTRICAL',
                base_price: 500,
                duration_minutes: 60,
                is_active: true,
                image_url: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800',
            }
        });
        console.log('✅ Created service: Ceiling Fan Installation');

        const service4 = await prisma.service.create({
            data: {
                name: 'Plumbing Repair',
                description: 'Fix leaking taps, pipes, and general plumbing issues',
                category: 'PLUMBING',
                base_price: 600,
                duration_minutes: 75,
                is_active: true,
                image_url: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800',
            }
        });
        console.log('✅ Created service: Plumbing Repair');

        const service5 = await prisma.service.create({
            data: {
                name: 'Sofa Cleaning',
                description: 'Professional sofa and upholstery cleaning service',
                category: 'CLEANING',
                base_price: 900,
                duration_minutes: 120,
                is_active: true,
                image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
            }
        });
        console.log('✅ Created service: Sofa Cleaning');

        const service6 = await prisma.service.create({
            data: {
                name: 'Furniture Assembly',
                description: 'Expert furniture assembly and installation service',
                category: 'CARPENTRY',
                base_price: 700,
                duration_minutes: 90,
                is_active: true,
                image_url: 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?w=800',
            }
        });
        console.log('✅ Created service: Furniture Assembly');

        console.log('\n✅ Database seeding completed successfully!');
        console.log(`\nTotal Partners: ${await prisma.servicePartner.count()}`);
        console.log(`Total Services: ${await prisma.service.count()}`);

    } catch (error) {
        console.error('❌ Error during seeding:', error);
        throw error;
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
