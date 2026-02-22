import { PrismaClient, UserRole, BookingStatus, KycStatus, PartnerAvailability } from '@prisma/client';
import { hashPassword } from '../src/utils/encryption';

const prisma = new PrismaClient();

// Professional images from Unsplash (free to use)
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
    console.log('🌱 Starting perfect database seed with images...\n');

    // Clear existing data to avoid unique constraint violations
    console.log('🧹 Clearing existing data...');
    await prisma.notification.deleteMany();
    await prisma.rating.deleteMany();
    await prisma.bookingItem.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.partnerService.deleteMany();
    await prisma.servicePartner.deleteMany();
    await prisma.businessPartner.deleteMany();
    await prisma.service.deleteMany();
    await prisma.category.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Database cleared.\n');

    const hashedPassword = await hashPassword('password123');

    // 0. Create Permissions and Roles
    console.log('🔐 Creating permissions and roles...');

    const permissions = [
        { name: 'USER_VIEW', description: 'View users' },
        { name: 'USER_MANAGE', description: 'Create, update, delete users' },
        { name: 'BOOKING_VIEW', description: 'View bookings' },
        { name: 'BOOKING_MANAGE', description: 'Manage bookings' },
        { name: 'ROLE_MANAGE', description: 'Manage roles and permissions' },
        { name: 'SERVICE_MANAGE', description: 'Manage services and categories' },
        { name: 'KYC_MANAGE', description: 'Manage KYC verifications' },
        { name: 'REPORT_VIEW', description: 'View dashboard reports' },
    ];

    const createdPermissions = await Promise.all(
        permissions.map((p: { name: string, description: string }) => prisma.permission.create({ data: p }))
    );

    const superAdminRole = await prisma.role.create({
        data: {
            name: 'SUPER_ADMIN',
            description: 'Full system access',
            permissions: {
                create: createdPermissions.map((p: { id: string }) => ({
                    permission_id: p.id
                }))
            }
        }
    });

    const adminRole = await prisma.role.create({
        data: {
            name: 'ADMIN',
            description: 'Administrative access',
            permissions: {
                create: createdPermissions
                    .filter((p: { name: string }) => !['ROLE_MANAGE'].includes(p.name))
                    .map((p: { id: string }) => ({
                        permission_id: p.id
                    }))
            }
        }
    });

    console.log('✅ RBAC setup complete.\n');


    // 1. Create Admin Users
    console.log('👥 Creating admin users...');

    await prisma.user.create({
        data: {
            email: 'superadmin@snearal.com',
            password: hashedPassword,
            full_name: 'Super Administrator',
            phone_number: '+919999999999',
            role: UserRole.SUPER_ADMIN,
            role_id: superAdminRole.id,
            email_verified: true,
            phone_verified: true,
            profile: {
                create: {
                    address: 'Corporate Office, MG Road',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    postal_code: '560001',
                    country: 'India',
                },
            },
            wallet: { create: { balance: 0 } },
        },
    });

    await prisma.user.create({
        data: {
            email: 'admin@snearal.com',
            password: hashedPassword,
            full_name: 'John Anderson',
            phone_number: '+919876543210',
            role: UserRole.ADMIN,
            role_id: adminRole.id,
            email_verified: true,
            phone_verified: true,
            profile: {
                create: {
                    address: '456 Admin Tower, Whitefield',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    postal_code: '560066',
                    country: 'India',
                },
            },
            wallet: { create: { balance: 0 } },
        },
    });

    // 2. Create Customers
    console.log('👨‍👩‍👧 Creating customers...');

    const customers = await Promise.all([
        prisma.user.create({
            data: {
                email: 'rajesh.kumar@gmail.com',
                password: hashedPassword,
                full_name: 'Rajesh Kumar',
                phone_number: '+919876543212',
                role: UserRole.CUSTOMER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '101 Green Park, Koramangala',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560034',
                        country: 'India',
                        latitude: 12.9352,
                        longitude: 77.6245,
                    },
                },
                wallet: { create: { balance: 5000 } },
            },
        }),
        prisma.user.create({
            data: {
                email: 'priya.sharma@gmail.com',
                password: hashedPassword,
                full_name: 'Priya Sharma',
                phone_number: '+919876543213',
                role: UserRole.CUSTOMER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '202 Prestige Heights, Indiranagar',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560038',
                        country: 'India',
                        latitude: 12.9784,
                        longitude: 77.6408,
                    },
                },
                wallet: { create: { balance: 3500 } },
            },
        }),
        prisma.user.create({
            data: {
                email: 'amit.patel@yahoo.com',
                password: hashedPassword,
                full_name: 'Amit Patel',
                phone_number: '+919876543214',
                role: UserRole.CUSTOMER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '303 Brigade Gateway, Rajajinagar',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560010',
                        country: 'India',
                        latitude: 12.9916,
                        longitude: 77.5712,
                    },
                },
                wallet: { create: { balance: 7500 } },
            },
        }),
        prisma.user.create({
            data: {
                email: 'sneha.reddy@outlook.com',
                password: hashedPassword,
                full_name: 'Sneha Reddy',
                phone_number: '+919876543215',
                role: UserRole.CUSTOMER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '404 Sobha Dream Acres, Whitefield',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560066',
                        country: 'India',
                        latitude: 12.9698,
                        longitude: 77.7500,
                    },
                },
                wallet: { create: { balance: 2000 } },
            },
        }),
        prisma.user.create({
            data: {
                email: 'vikram.singh@gmail.com',
                password: hashedPassword,
                full_name: 'Vikram Singh',
                phone_number: '+919876543216',
                role: UserRole.CUSTOMER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '505 Embassy Pristine, Bellandur',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560103',
                        country: 'India',
                        latitude: 12.9141,
                        longitude: 77.6411,
                    },
                },
                wallet: { create: { balance: 10000 } },
            },
        }),
    ]);

    // 3. Create Categories with Icons
    console.log('📂 Creating service categories with icons...');

    const categories = await Promise.all([
        prisma.category.create({
            data: {
                name: 'Home Cleaning',
                description: 'Professional home cleaning and sanitization services',
                icon_url: CATEGORY_ICONS.cleaning,
                is_active: true,
                display_order: 1,
            },
        }),
        prisma.category.create({
            data: {
                name: 'Electrical Services',
                description: 'Expert electrical repair, installation, and maintenance',
                icon_url: CATEGORY_ICONS.electrical,
                is_active: true,
                display_order: 2,
            },
        }),
        prisma.category.create({
            data: {
                name: 'Plumbing',
                description: 'Plumbing installation, repair, and emergency services',
                icon_url: CATEGORY_ICONS.plumbing,
                is_active: true,
                display_order: 3,
            },
        }),
        prisma.category.create({
            data: {
                name: 'Carpentry',
                description: 'Custom furniture making and repair services',
                icon_url: CATEGORY_ICONS.carpentry,
                is_active: true,
                display_order: 4,
            },
        }),
        prisma.category.create({
            data: {
                name: 'Appliance Repair',
                description: 'Repair services for all home appliances',
                icon_url: CATEGORY_ICONS.appliance,
                is_active: true,
                display_order: 5,
            },
        }),
        prisma.category.create({
            data: {
                name: 'Painting',
                description: 'Interior and exterior painting services',
                icon_url: CATEGORY_ICONS.painting,
                is_active: true,
                display_order: 6,
            },
        }),
    ]);

    //  4. Create Business Partner
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
            profile: {
                create: {
                    address: '100 Business Hub, Electronic City',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    postal_code: '560100',
                    country: 'India',
                },
            },
            wallet: { create: { balance: 50000 } },
        },
    });

    const businessPartner = await prisma.businessPartner.create({
        data: {
            user_id: businessPartnerUser.id,
            business_name: 'HomeCare Services Pvt Ltd',
            category_id: categories[0].id,
            business_type: 'Home Services Provider',
            business_license: 'BIZ-KA-2024-12345',
            gst_number: 'GST29ABCDE1234F1Z5',
            kyc_status: KycStatus.APPROVED,
            kyc_verified_at: new Date('2024-12-01'),
            commission_rate: 0.15,
            bank_account_number: '1234567890123456',
            bank_ifsc_code: 'HDFC0001234',
            bank_account_name: 'HomeCare Services Pvt Ltd',
        },
    });

    // 5. Create Service Partners
    console.log('👷 Creating service partners...');

    const servicePartners = await Promise.all([
        prisma.user.create({
            include: { service_partner: true, profile: true },
            data: {
                email: 'ramesh.electrician@service.com',
                password: hashedPassword,
                full_name: 'Ramesh Kumar',
                phone_number: '+919876543220',
                role: UserRole.SERVICE_PARTNER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '55 Worker Colony, Marathahalli',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560076',
                        country: 'India',
                        latitude: 12.9141,
                        longitude: 77.6411,
                    },
                },
                service_partner: {
                    create: {
                        business_partner_id: businessPartner.id,
                        category_id: categories[1].id,
                        availability_status: PartnerAvailability.AVAILABLE,
                        current_latitude: 12.9141,
                        current_longitude: 77.6411,
                        service_radius: 10,
                        avg_rating: 4.8,
                        total_ratings: 45,
                        completion_rate: 95.8,
                        total_bookings: 120,
                        completed_bookings: 115,
                        kyc_status: KycStatus.APPROVED,
                        kyc_verified_at: new Date('2024-12-01'),
                        bank_account_number: '9876543210123456',
                        bank_ifsc_code: 'HDFC0001234',
                        bank_account_name: 'Ramesh Kumar',
                    },
                },
                wallet: { create: { balance: 8500 } },
            },
        }),
        prisma.user.create({
            include: { service_partner: true, profile: true },
            data: {
                email: 'suresh.plumber@service.com',
                password: hashedPassword,
                full_name: 'Suresh Patel',
                phone_number: '+919876543221',
                role: UserRole.SERVICE_PARTNER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '66 Service Lane, HSR Layout',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560102',
                        country: 'India',
                        latitude: 12.9116,
                        longitude: 77.6382,
                    },
                },
                service_partner: {
                    create: {
                        business_partner_id: businessPartner.id,
                        category_id: categories[2].id,
                        availability_status: PartnerAvailability.AVAILABLE,
                        current_latitude: 12.9116,
                        current_longitude: 77.6382,
                        service_radius: 10,
                        avg_rating: 4.9,
                        total_ratings: 60,
                        completion_rate: 97.8,
                        total_bookings: 180,
                        completed_bookings: 176,
                        kyc_status: KycStatus.APPROVED,
                        kyc_verified_at: new Date('2024-12-01'),
                        bank_account_number: '8765432101234567',
                        bank_ifsc_code: 'HDFC0001234',
                        bank_account_name: 'Suresh Patel',
                    },
                },
                wallet: { create: { balance: 12000 } },
            },
        }),
        prisma.user.create({
            include: { service_partner: true, profile: true },
            data: {
                email: 'kumar.carpenter@service.com',
                password: hashedPassword,
                full_name: 'Kumar Reddy',
                phone_number: '+919876543222',
                role: UserRole.SERVICE_PARTNER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '77 Craftsman Street, BTM Layout',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560076',
                        country: 'India',
                        latitude: 12.9165,
                        longitude: 77.6101,
                    },
                },
                service_partner: {
                    create: {
                        business_partner_id: businessPartner.id,
                        category_id: categories[3].id,
                        availability_status: PartnerAvailability.AVAILABLE,
                        current_latitude: 12.9165,
                        current_longitude: 77.6101,
                        service_radius: 10,
                        avg_rating: 4.6,
                        total_ratings: 35,
                        completion_rate: 94.7,
                        total_bookings: 95,
                        completed_bookings: 90,
                        kyc_status: KycStatus.APPROVED,
                        kyc_verified_at: new Date('2024-12-01'),
                        bank_account_number: '7654321012345678',
                        bank_ifsc_code: 'HDFC0001234',
                        bank_account_name: 'Kumar Reddy',
                    },
                },
                wallet: { create: { balance: 5200 } },
            },
        }),
        prisma.user.create({
            include: { service_partner: true, profile: true },
            data: {
                email: 'deepak.cleaner@service.com',
                password: hashedPassword,
                full_name: 'Deepak Sharma',
                phone_number: '+919876543223',
                role: UserRole.SERVICE_PARTNER,
                email_verified: true,
                phone_verified: true,
                profile: {
                    create: {
                        address: '88 Service Road, JP Nagar',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        postal_code: '560078',
                        country: 'India',
                        latitude: 12.9081,
                        longitude: 77.5859,
                    },
                },
                service_partner: {
                    create: {
                        business_partner_id: businessPartner.id,
                        category_id: categories[0].id,
                        availability_status: PartnerAvailability.AVAILABLE,
                        current_latitude: 12.9081,
                        current_longitude: 77.5859,
                        service_radius: 10,
                        avg_rating: 4.7,
                        total_ratings: 52,
                        completion_rate: 96.4,
                        total_bookings: 140,
                        completed_bookings: 135,
                        kyc_status: KycStatus.APPROVED,
                        kyc_verified_at: new Date('2024-12-01'),
                        bank_account_number: '6543210123456789',
                        bank_ifsc_code: 'HDFC0001234',
                        bank_account_name: 'Deepak Sharma',
                    },
                },
                wallet: { create: { balance: 9800 } },
            },
        }),
    ]);

    // 6. Create Services with Beautiful Images
    console.log('⚙️ Creating services with professional images...');

    const services = await Promise.all([
        prisma.service.create({
            data: {
                category_id: categories[0].id,
                name: 'Deep Home Cleaning',
                description: 'Complete deep cleaning of entire home including kitchen, bathrooms, bedrooms, and living areas. Professional team with eco-friendly products.',
                base_price: 1999,
                duration: 240,
                image_url: SERVICE_IMAGES.deepCleaning,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[0].id,
                name: 'Sofa Cleaning',
                description: 'Professional sofa and upholstery cleaning with advanced steam cleaning technology. Removes stains and allergens.',
                base_price: 599,
                duration: 90,
                image_url: SERVICE_IMAGES.sofaCleaning,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[1].id,
                name: 'Fan Installation & Repair',
                description: 'Professional installation, repair, and servicing of ceiling fans. Includes wiring and mounting.',
                base_price: 299,
                duration: 60,
                image_url: SERVICE_IMAGES.fanInstall,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[1].id,
                name: 'Light Fixture Installation',
                description: 'Expert installation of lights, chandeliers, and decorative fixtures. Safe wiring and perfect mounting.',
                base_price: 399,
                duration: 90,
                image_url: SERVICE_IMAGES.lightInstall,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[2].id,
                name: 'Tap/Faucet Repair',
                description: 'Quick and efficient repair of leaking or broken taps and faucets. Includes replacement of washers and seals.',
                base_price: 249,
                duration: 45,
                image_url: SERVICE_IMAGES.tapRepair,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[2].id,
                name: 'Bathroom Plumbing',
                description: 'Complete bathroom plumbing installation and repair including toilets, sinks, showers, and drainage.',
                base_price: 2999,
                duration: 300,
                image_url: SERVICE_IMAGES.bathPlumbing,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[3].id,
                name: 'Furniture Assembly',
                description: 'Professional assembly of flat-pack furniture from IKEA, Amazon, and other brands. Quick and hassle-free.',
                base_price: 499,
                duration: 120,
                image_url: SERVICE_IMAGES.furniture,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[4].id,
                name: 'AC Servicing',
                description: 'Complete air conditioner cleaning, gas refill, and servicing for all brands. Includes filter cleaning.',
                base_price: 799,
                duration: 120,
                image_url: SERVICE_IMAGES.acService,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[4].id,
                name: 'Washing Machine Repair',
                description: 'Expert repair and servicing of all washing machine brands. Covers both top-load and front-load machines.',
                base_price: 599,
                duration: 90,
                image_url: SERVICE_IMAGES.washingMachine,
                is_active: true,
            },
        }),
        prisma.service.create({
            data: {
                category_id: categories[5].id,
                name: 'Room Painting',
                description: 'Professional interior painting for single room with premium quality Asian Paints. Includes wall preparation.',
                base_price: 3999,
                duration: 480,
                image_url: SERVICE_IMAGES.painting,
                is_active: true,
            },
        }),
    ]);

    // 7. Link Partners to Services
    console.log('🔗 Linking partners to services...');

    await Promise.all([
        prisma.partnerService.create({
            data: {
                service_id: services[2].id,
                partner_id: servicePartners[0].service_partner!.id,
                custom_price: 279,
                is_available: true,
            },
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[3].id,
                partner_id: servicePartners[0].service_partner!.id,
                custom_price: 379,
                is_available: true,
            },
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[4].id,
                partner_id: servicePartners[1].service_partner!.id,
                custom_price: 229,
                is_available: true,
            },
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[5].id,
                partner_id: servicePartners[1].service_partner!.id,
                custom_price: 2799,
                is_available: true,
            },
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[6].id,
                partner_id: servicePartners[2].service_partner!.id,
                custom_price: 479,
                is_available: true,
            },
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[0].id,
                partner_id: servicePartners[3].service_partner!.id,
                custom_price: 1899,
                is_available: true,
            },
        }),
        prisma.partnerService.create({
            data: {
                service_id: services[1].id,
                partner_id: servicePartners[3].service_partner!.id,
                custom_price: 549,
                is_available: true,
            },
        }),
    ]);

    // 8. Create Sample Bookings
    console.log('📅 Creating sample bookings...');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const sampleBookingsData = [
        {
            customer: customers[0],
            service: services[1],
            partner: servicePartners[3],
            status: BookingStatus.COMPLETED,
            date: `${todayStr}T10:00:00`,
            completed_at: today,
            amount: 549,
            review: 'Excellent service! The sofa looks brand new now.'
        },
        {
            customer: customers[1],
            service: services[2],
            partner: servicePartners[0],
            status: BookingStatus.PARTNER_ASSIGNED,
            date: `${todayStr}T14:00:00`,
            amount: 279
        },
        {
            customer: customers[2],
            service: services[0],
            partner: null,
            status: BookingStatus.PENDING,
            date: '2026-02-10T09:00:00',
            amount: 1899
        },
        {
            customer: customers[3],
            service: services[4],
            partner: null,
            status: BookingStatus.SEARCHING_PARTNER,
            date: '2026-02-11T11:00:00',
            amount: 229
        },
        {
            customer: customers[4],
            service: services[5],
            partner: servicePartners[1],
            status: BookingStatus.IN_PROGRESS,
            date: `${todayStr}T11:00:00`,
            amount: 2799
        },
        {
            customer: customers[0],
            service: services[6],
            partner: servicePartners[2],
            status: BookingStatus.COMPLETED,
            date: `${todayStr}T08:00:00`,
            completed_at: today,
            amount: 479
        },
        {
            customer: customers[1],
            service: services[3],
            partner: servicePartners[0],
            status: BookingStatus.CANCELLED,
            date: `${todayStr}T16:00:00`,
            amount: 379
        },
        {
            customer: customers[2],
            service: services[7],
            partner: null,
            status: BookingStatus.PENDING,
            date: '2026-02-12T10:00:00',
            amount: 1499
        },
        {
            customer: customers[3],
            service: services[8],
            partner: null,
            status: BookingStatus.SEARCHING_PARTNER,
            date: `${todayStr}T15:00:00`,
            amount: 899
        }
    ];

    // Set some partners as PENDING_VERIFICATION for demo
    await prisma.servicePartner.update({
        where: { id: servicePartners[2].service_partner!.id },
        data: { kyc_status: KycStatus.PENDING_VERIFICATION }
    });

    for (const data of sampleBookingsData) {
        const booking = await prisma.booking.create({
            data: {
                booking_number: `BK${Date.now()}${Math.floor(Math.random() * 1000)}`,
                customer_id: data.customer.id,
                partner_id: (data.partner as any)?.service_partner?.id || null,
                status: data.status,
                scheduled_date: new Date(data.date),
                scheduled_time: '10:00 AM',
                service_address: (data.customer as any).profile?.address || 'Bangalore, Karnataka',
                service_latitude: (data.customer as any).profile?.latitude || 12.9716,
                service_longitude: (data.customer as any).profile?.longitude || 77.5946,
                total_amount: data.amount,
                advance_amount: Math.round(data.amount * 0.3),
                remaining_amount: Math.round(data.amount * 0.7),
                payment_method: 'CASH',
                completed_at: (data as any).completed_at || null,
                items: {
                    create: {
                        service_id: data.service.id,
                        quantity: 1,
                        unit_price: data.amount,
                        total_price: data.amount
                    }
                }
            } as any
        });

        if (data.review && data.partner) {
            await prisma.rating.create({
                data: {
                    booking_id: booking.id,
                    rater_id: data.customer.id,
                    rated_id: data.partner.id,
                    rating: 5,
                    review: data.review,
                }
            });
        }
    }


    console.log('\n📊 Seed Summary:');
    console.log('================');
    console.log('👥 Total Users: 12');
    console.log('   - Super Admins: 1');
    console.log('   - Admins: 1');
    console.log('   - Customers: 5');
    console.log('   - Business Partners: 1');
    console.log('   - Service Partners: 4');
    console.log('📂 Categories: 6 (with professional icons)');
    console.log('⚙️ Services: 10 (with high-quality images)');
    console.log('🔗 Partner Services: 7');
    console.log('📅 Bookings: 12 (various statuses)');
    console.log('⭐ Ratings: 1');
    console.log('💰 Wallets: 12');


    console.log('\n✨ Database seeded successfully with beautiful images!\n');
    console.log('🖼️ All services have professional Unsplash images');
    console.log('🎨 All categories have beautiful icons\n');

    console.log('🔐 Test Credentials (password: password123):');
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
