import { PrismaClient, UserRole, KycStatus, PartnerAvailability } from '@prisma/client';
import { hashPassword } from '../src/utils/encryption';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed with comprehensive data...');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await prisma.rating.deleteMany();
    await prisma.bookingStatusHistory.deleteMany();
    await prisma.bookingItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.partnerService.deleteMany();
    await prisma.service.deleteMany();
    await prisma.category.deleteMany();
    await prisma.message.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.kycDocument.deleteMany();
    await prisma.servicePartner.deleteMany();
    await prisma.businessPartner.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();

    const hashedPassword = await hashPassword('password123');

    // 1. Create Admin Users
    console.log('👥 Creating admin users...');

    const superAdmin = await prisma.user.create({
        data: {
            email: 'superadmin@snearal.com',
            password: hashedPassword,
            full_name: 'Super Administrator',
            phone_number: '+919999999999',
            role: UserRole.SUPER_ADMIN,
            email_verified: true,
            phone_verified: true,
        }
    });

    await prisma.profile.create({
        data: {
            user_id: superAdmin.id,
            address: 'Corporate Office, MG Road',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560001',
            country: 'India',
        }
    });

    const admin = await prisma.user.create({
        data: {
            email: 'admin@snearal.com',
            password: hashedPassword,
            full_name: 'John Anderson',
            phone_number: '+919876543210',
            role: UserRole.ADMIN,
            email_verified: true,
            phone_verified: true,
        }
    });

    await prisma.profile.create({
        data: {
            user_id: admin.id,
            address: '456 Admin Tower, Whitefield',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560066',
            country: 'India',
        }
    });

    // 2. Create Customers
    console.log('👨‍👩‍👧 Creating customers...');

    const customers = [];
    const customerData = [
        {
            email: 'rajesh.kumar@gmail.com',
            full_name: 'Rajesh Kumar',
            phone: '+919876543212',
            address: '101 Green Park Apartments, Koramangala',
            city: 'Bangalore',
            postal_code: '560034',
            lat: 12.9352,
            lng: 77.6245,
            wallet_balance: 5000
        },
        {
            email: 'priya.sharma@gmail.com',
            full_name: 'Priya Sharma',
            phone: '+919876543213',
            address: '202 Prestige Heights, Indiranagar',
            city: 'Bangalore',
            postal_code: '560038',
            lat: 12.9784,
            lng: 77.6408,
            wallet_balance: 3500
        },
        {
            email: 'amit.patel@yahoo.com',
            full_name: 'Amit Patel',
            phone: '+919876543214',
            address: '303 Brigade Gateway, Rajajinagar',
            city: 'Bangalore',
            postal_code: '560010',
            lat: 12.9916,
            lng: 77.5712,
            wallet_balance: 7500
        },
        {
            email: 'sneha.reddy@outlook.com',
            full_name: 'Sneha Reddy',
            phone: '+919876543215',
            address: '404 Sobha Dream Acres, Whitefield',
            city: 'Bangalore',
            postal_code: '560066',
            lat: 12.9698,
            lng: 77.7500,
            wallet_balance: 2000
        },
        {
            email: 'vikram.singh@gmail.com',
            full_name: 'Vikram Singh',
            phone: '+919876543216',
            address: '505 Embassy Pristine, Bellandur',
            city: 'Bangalore',
            postal_code: '560103',
            lat: 12.9141,
            lng: 77.6411,
            wallet_balance: 10000
        }
    ];

    for (const data of customerData) {
        const user = await prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                full_name: data.full_name,
                phone_number: data.phone,
                role: UserRole.CUSTOMER,
                email_verified: true,
                phone_verified: true,
            }
        });

        await prisma.profile.create({
            data: {
                user_id: user.id,
                address: data.address,
                city: data.city,
                state: 'Karnataka',
                postal_code: data.postal_code,
                country: 'India',
                latitude: data.lat,
                longitude: data.lng,
            }
        });

        await prisma.wallet.create({
            data: {
                user_id: user.id,
                balance: data.wallet_balance,
                locked_balance: 0,
            }
        });

        customers.push(user);
    }

    // 3. Create Categories
    console.log('📂 Creating service categories...');

    const categoryEntities = await Promise.all([
        prisma.category.create({
            data: {
                name: 'Home Cleaning',
                description: 'Professional home cleaning and sanitization services',
                icon_url: 'https://cdn.snearal.com/icons/cleaning.svg',
                is_active: true,
                display_order: 1,
            }
        }),
        prisma.category.create({
            data: {
                name: 'Electrical Services',
                description: 'Expert electrical repair, installation, and maintenance',
                icon_url: 'https://cdn.snearal.com/icons/electrical.svg',
                is_active: true,
                display_order: 2,
            }
        }),
        prisma.category.create({
            data: {
                name: 'Plumbing',
                description: 'Plumbing installation, repair, and emergency services',
                icon_url: 'https://cdn.snearal.com/icons/plumbing.svg',
                is_active: true,
                display_order: 3,
            }
        }),
        prisma.category.create({
            data: {
                name: 'Carpentry',
                description: 'Custom furniture making and repair services',
                icon_url: 'https://cdn.snearal.com/icons/carpentry.svg',
                is_active: true,
                display_order: 4,
            }
        }),
        prisma.category.create({
            data: {
                name: 'Appliance Repair',
                description: 'Repair services for all home appliances',
                icon_url: 'https://cdn.snearal.com/icons/appliance.svg',
                is_active: true,
                display_order: 5,
            }
        }),
        prisma.category.create({
            data: {
                name: 'Painting',
                description: 'Interior and exterior painting services',
                icon_url: 'https://cdn.snearal.com/icons/painting.svg',
                is_active: true,
                display_order: 6,
            }
        })
    ]);

    const categoriesMap = categoryEntities.reduce((acc, cat) => {
        acc[cat.name] = cat.id;
        return acc;
    }, {} as Record<string, string>);

    // 4. Create Business Partner
    console.log('🏢 Creating business partner...');

    const businessPartnerUser = await prisma.user.create({
        data: {
            email: 'homecare@business.com',
            password: hashedPassword,
            full_name: 'HomeCare Services Pvt Ltd',
            phone_number: '+919123456789',
            role: UserRole.BUSINESS_PARTNER,
            email_verified: true,
            phone_verified: true,
        }
    });

    await prisma.profile.create({
        data: {
            user_id: businessPartnerUser.id,
            address: '100 Business Hub, Electronic City',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560100',
            country: 'India',
        }
    });

    const businessPartner = await prisma.businessPartner.create({
        data: {
            user_id: businessPartnerUser.id,
            business_name: 'HomeCare Services Pvt Ltd',
            category_id: categoriesMap['Home Cleaning'],
            business_type: 'Home Services Provider',
            business_license: 'BIZ-KA-2024-12345',
            gst_number: 'GST29ABCDE1234F1Z5',
            kyc_status: KycStatus.APPROVED,
            kyc_verified_at: new Date('2024-12-01'),
            commission_rate: 0.15,
            bank_account_number: '1234567890123456',
            bank_ifsc_code: 'HDFC0001234',
            bank_account_name: 'HomeCare Services Pvt Ltd',
        }
    });

    await prisma.wallet.create({
        data: {
            user_id: businessPartnerUser.id,
            balance: 50000,
        }
    });

    // 5. Create Service Partners
    console.log('👷 Creating service partners...');

    const servicePartners = [];
    const partnerData = [
        {
            email: 'ramesh.electrician@service.com',
            full_name: 'Ramesh Kumar (Electrician)',
            phone: '+919876543220',
            address: '55 Worker Colony, Marathahalli',
            lat: 12.9141,
            lng: 77.6411,
            rating: 4.8,
            total_ratings: 45,
            bookings: 120,
            completed: 115,
            category: 'Electrical Services'
        },
        {
            email: 'suresh.plumber@service.com',
            full_name: 'Suresh Patil (Plumber)',
            phone: '+919876543221',
            address: '66 Service Lane, HSR Layout',
            lat: 12.9116,
            lng: 77.6382,
            rating: 4.9,
            total_ratings: 60,
            bookings: 180,
            completed: 176,
            category: 'Plumbing'
        },
        {
            email: 'kumar.carpenter@service.com',
            full_name: 'Kumar Reddy (Carpenter)',
            phone: '+919876543222',
            address: '77 Craftsman Street, BTM Layout',
            lat: 12.9165,
            lng: 77.6101,
            rating: 4.6,
            total_ratings: 35,
            bookings: 95,
            completed: 90,
            category: 'Carpentry'
        },
        {
            email: 'deepak.cleaner@service.com',
            full_name: 'Deepak Sharma (Cleaning)',
            phone: '+919876543223',
            address: '88 Service Road, JP Nagar',
            lat: 12.9081,
            lng: 77.5859,
            rating: 4.7,
            total_ratings: 52,
            bookings: 140,
            completed: 135,
            category: 'Home Cleaning'
        }
    ];

    for (const data of partnerData) {
        const user = await prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                full_name: data.full_name,
                phone_number: data.phone,
                role: UserRole.SERVICE_PARTNER,
                email_verified: true,
                phone_verified: true,
            }
        });

        await prisma.profile.create({
            data: {
                user_id: user.id,
                address: data.address,
                city: 'Bangalore',
                state: 'Karnataka',
                postal_code: '560076',
                country: 'India',
                latitude: data.lat,
                longitude: data.lng,
            }
        });

        const partner = await prisma.servicePartner.create({
            data: {
                user_id: user.id,
                business_partner_id: businessPartner.id,
                availability_status: PartnerAvailability.AVAILABLE,
                current_latitude: data.lat,
                current_longitude: data.lng,
                service_radius: 10,
                avg_rating: data.rating,
                total_ratings: data.total_ratings,
                completion_rate: (data.completed / data.bookings) * 100,
                total_bookings: data.bookings,
                completed_bookings: data.completed,
                category_id: categoriesMap[data.category],
                kyc_status: KycStatus.APPROVED,
                kyc_verified_at: new Date('2024-12-01'),
                bank_account_number: `${Math.floor(Math.random() * 10000000000)}`,
                bank_ifsc_code: 'HDFC0001234',
                bank_account_name: data.full_name.split('(')[0].trim(),
            }
        });

        await prisma.wallet.create({
            data: {
                user_id: user.id,
                balance: Math.floor(Math.random() * 15000) + 5000,
            }
        });

        servicePartners.push(partner);
    }

    // 6. Create Services
    console.log('⚙️ Creating services...');

    const services = await Promise.all([
        // Cleaning
        prisma.service.create({
            data: {
                category_id: categoryEntities[0].id,
                name: 'Deep Home Cleaning',
                description: 'Complete deep cleaning of entire home including kitchen, bathrooms, bedrooms',
                base_price: 1999,
                duration: 240,
                image_url: 'https://cdn.snearal.com/services/deep-cleaning.jpg',
                is_active: true,
            }
        }),
        prisma.service.create({
            data: {
                category_id: categoryEntities[0].id,
                name: 'Sofa Cleaning',
                description: 'Professional sofa and upholstery cleaning',
                base_price: 599,
                duration: 90,
                image_url: 'https://cdn.snearal.com/services/sofa-cleaning.jpg',
                is_active: true,
            }
        }),
        // Electrical
        prisma.service.create({
            data: {
                category_id: categoryEntities[1].id,
                name: 'Fan Installation & Repair',
                description: 'Installation, repair, and servicing of ceiling fans',
                base_price: 299,
                duration: 60,
                image_url: 'https://cdn.snearal.com/services/fan-installation.jpg',
                is_active: true,
            }
        }),
        prisma.service.create({
            data: {
                category_id: categoryEntities[1].id,
                name: 'Light Fixture Installation',
                description: 'Installation of lights, chandeliers, and fixtures',
                base_price: 399,
                duration: 90,
                image_url: 'https://cdn.snearal.com/services/light-installation.jpg',
                is_active: true,
            }
        }),
        // Plumbing
        prisma.service.create({
            data: {
                category_id: categoryEntities[2].id,
                name: 'Tap/Faucet Repair',
                description: 'Fix leaking or broken taps and faucets',
                base_price: 249,
                duration: 45,
                image_url: 'https://cdn.snearal.com/services/tap-repair.jpg',
                is_active: true,
            }
        }),
        prisma.service.create({
            data: {
                category_id: categoryEntities[2].id,
                name: 'Bathroom Plumbing',
                description: 'Complete bathroom plumbing installation and repair',
                base_price: 2999,
                duration: 300,
                image_url: 'https://cdn.snearal.com/services/bathroom-plumbing.jpg',
                is_active: true,
            }
        }),
        // Carpentry
        prisma.service.create({
            data: {
                category_id: categoryEntities[3].id,
                name: 'Furniture Assembly',
                description: 'Assembly of flat-pack furniture',
                base_price: 499,
                duration: 120,
                image_url: 'https://cdn.snearal.com/services/furniture-assembly.jpg',
                is_active: true,
            }
        }),
        // Appliance
        prisma.service.create({
            data: {
                category_id: categoryEntities[4].id,
                name: 'AC Servicing',
                description: 'Air conditioner cleaning, gas refill, and servicing',
                base_price: 799,
                duration: 120,
                image_url: 'https://cdn.snearal.com/services/ac-service.jpg',
                is_active: true,
            }
        }),
        prisma.service.create({
            data: {
                category_id: categoryEntities[4].id,
                name: 'Washing Machine Repair',
                description: 'Repair and servicing of washing machines',
                base_price: 599,
                duration: 90,
                image_url: 'https://cdn.snearal.com/services/washing-machine.jpg',
                is_active: true,
            }
        }),
        // Painting
        prisma.service.create({
            data: {
                category_id: categoryEntities[5].id,
                name: 'Room Painting',
                description: 'Interior painting for single room',
                base_price: 3999,
                duration: 480,
                image_url: 'https://cdn.snearal.com/services/room-painting.jpg',
                is_active: true,
            }
        })
    ]);

    // 7. Link Partners to Services
    console.log('🔗 Linking partners to services...');

    await Promise.all([
        // Electrician
        prisma.partnerService.create({
            data: {
                service_id: services[2].id, // Fan Installation
                partner_id: servicePartners[0].id,
                custom_price: 279,
                is_available: true,
            }
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[3].id, // Light Fixture
                partner_id: servicePartners[0].id,
                custom_price: 379,
                is_available: true,
            }
        }),
        // Plumber
        prisma.partnerService.create({
            data: {
                service_id: services[4].id, // Tap Repair
                partner_id: servicePartners[1].id,
                custom_price: 229,
                is_available: true,
            }
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[5].id, // Bathroom Plumbing
                partner_id: servicePartners[1].id,
                custom_price: 2799,
                is_available: true,
            }
        }),
        // Carpenter
        prisma.partnerService.create({
            data: {
                service_id: services[6].id, // Furniture Assembly
                partner_id: servicePartners[2].id,
                custom_price: 479,
                is_available: true,
            }
        }),
        // Cleaner
        prisma.partnerService.create({
            data: {
                service_id: services[0].id, // Deep Cleaning
                partner_id: servicePartners[3].id,
                custom_price: 1899,
                is_available: true,
            }
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[1].id, // Sofa Cleaning
                partner_id: servicePartners[3].id,
                custom_price: 549,
                is_available: true,
            }
        })
    ]);

    // 8. Create KYC Documents
    console.log('📄 Creating KYC documents...');

    await Promise.all([
        prisma.kycDocument.create({
            data: {
                service_partner_id: servicePartners[0].id,
                document_type: 'AADHAAR',
                document_number: '1234-5678-9012',
                document_url: '/uploads/kyc/aadhaar-ramesh.pdf',
                status: KycStatus.APPROVED,
                verified_at: new Date('2024-12-01'),
                verified_by: admin.id,
            }
        }),
        prisma.kycDocument.create({
            data: {
                service_partner_id: servicePartners[1].id,
                document_type: 'PAN',
                document_number: 'ABCDE1234F',
                document_url: '/uploads/kyc/pan-suresh.pdf',
                status: KycStatus.APPROVED,
                verified_at: new Date('2024-12-01'),
                verified_by: admin.id,
            }
        }),
        prisma.kycDocument.create({
            data: {
                business_partner_id: businessPartner.id,
                document_type: 'GST_CERTIFICATE',
                document_number: 'GST29ABCDE1234F1Z5',
                document_url: '/uploads/kyc/gst-homecare.pdf',
                status: KycStatus.APPROVED,
                verified_at: new Date('2024-12-01'),
                verified_by: superAdmin.id,
            }
        })
    ]);

    console.log('\n📊 Seed Summary:');
    console.log('================');
    const userCount = await prisma.user.count();
    const categoryCount = await prisma.category.count();
    const serviceCount = await prisma.service.count();
    const partnerCount = await prisma.servicePartner.count();
    const kycCount = await prisma.kycDocument.count();

    console.log(`👥 Total Users: ${userCount}`);
    console.log(`   - Super Admins: 1`);
    console.log(`   - Admins: 1`);
    console.log(`   - Customers: 5`);
    console.log(`   - Business Partners: 1`);
    console.log(`   - Service Partners: ${partnerCount}`);
    console.log(`📂 Categories: ${categoryCount}`);
    console.log(`⚙️ Services: ${serviceCount}`);
    console.log(`🔗 Partner Services: 7`);
    console.log(`📄 KYC Documents: ${kycCount}`);
    console.log(`💰 Wallets Created: ${userCount}`);

    console.log('\n✨ Database seeded successfully!');
    console.log('\n🔐 Test Credentials (password: password123):');
    console.log('================');
    console.log('\n👨‍💼 Admin Accounts:');
    console.log('  Super Admin: superadmin@snearal.com');
    console.log('  Admin: admin@snearal.com');
    console.log('\n👤 Customer Accounts:');
    console.log('  1. rajesh.kumar@gmail.com (₹5,000 wallet)');
    console.log('  2. priya.sharma@gmail.com (₹3,500 wallet)');
    console.log('  3. amit.patel@yahoo.com (₹7,500 wallet)');
    console.log('  4. sneha.reddy@outlook.com (₹2,000 wallet)');
    console.log('  5. vikram.singh@gmail.com (₹10,000 wallet)');
    console.log('\n👷 Service Partner Accounts:');
    console.log('  1. ramesh.electrician@service.com (Electrician, 4.8⭐)');
    console.log('  2. suresh.plumber@service.com (Plumber, 4.9⭐)');
    console.log('  3. kumar.carpenter@service.com (Carpenter, 4.6⭐)');
    console.log('  4. deepak.cleaner@service.com (Cleaning, 4.7⭐)');
    console.log('\n🏢 Business Partner:');
    console.log('  homecare@business.com (₹50,000 wallet)');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
