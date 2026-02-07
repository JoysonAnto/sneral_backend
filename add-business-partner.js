const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addBusinessPartner() {
    console.log('\n🏢 Adding Business Partner account...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Check if already exists
    const existing = await prisma.user.findUnique({
        where: { email: 'homecare@business.com' }
    });

    if (existing) {
        console.log('✅ Business Partner account already exists!');
        console.log('   Email: homecare@business.com');
        console.log('   Role:', existing.role);
        await prisma.$disconnect();
        return;
    }

    // Get a category for the business partner
    const categories = await prisma.category.findMany({ take: 1 });
    if (categories.length === 0) {
        console.error('❌ No categories found. Please run full seed first.');
        await prisma.$disconnect();
        return;
    }

    // Create Business Partner User
    const businessPartnerUser = await prisma.user.create({
        data: {
            email: 'homecare@business.com',
            password: hashedPassword,
            full_name: 'HomeCare Services Pvt Ltd',
            phone_number: '+919123456789',
            role: 'BUSINESS_PARTNER',
            email_verified: true,
            phone_verified: true,
        },
    });

    // Create Profile
    await prisma.profile.create({
        data: {
            user_id: businessPartnerUser.id,
            address: '100 Business Hub, Electronic City',
            city: 'Bangalore',
            state: 'Karnataka',
            postal_code: '560100',
            country: 'India',
        },
    });

    // Create Wallet
    await prisma.wallet.create({
        data: {
            user_id: businessPartnerUser.id,
            balance: 50000,
        },
    });

    // Create Business Partner Record
    await prisma.businessPartner.create({
        data: {
            user_id: businessPartnerUser.id,
            business_name: 'HomeCare Services Pvt Ltd',
            category_id: categories[0].id,
            business_type: 'Home Services Provider',
            business_license: 'BIZ-KA-2024-12345',
            gst_number: 'GST29ABCDE1234F1Z5',
            kyc_status: 'APPROVED',
            kyc_verified_at: new Date('2024-12-01'),
            commission_rate: 0.15,
            bank_account_number: '1234567890123456',
            bank_ifsc_code: 'HDFC0001234',
            bank_account_name: 'HomeCare Services Pvt Ltd',
        },
    });

    console.log('✅ Business Partner added successfully!');
    console.log('\n📧 Login credentials:');
    console.log('   Email: homecare@business.com');
    console.log('   Password: password123');
    console.log('   Role: BUSINESS_PARTNER');
    console.log('   Wallet: ₹50,000\n');

    await prisma.$disconnect();
}

addBusinessPartner().catch(console.error);
