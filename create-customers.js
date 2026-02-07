// Create customer test accounts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createCustomers() {
    console.log('Creating customer test accounts...\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const customers = [
        { email: 'priya.sharma@gmail.com', full_name: 'Priya Sharma', phone: '+919876000001' },
        { email: 'vikram.singh@gmail.com', full_name: 'Vikram Singh', phone: '+919876000002' },
        { email: 'ananya.patel@gmail.com', full_name: 'Ananya Patel', phone: '+919876000003' },
        { email: 'rajesh.kumar@gmail.com', full_name: 'Rajesh Kumar', phone: '+919876000004' },
        { email: 'sneha.reddy@outlook.com', full_name: 'Sneha Reddy', phone: '+919876000005' },
    ];

    for (const customer of customers) {
        try {
            const user = await prisma.user.upsert({
                where: { email: customer.email },
                update: {
                    password: hashedPassword,
                },
                create: {
                    email: customer.email,
                    password: hashedPassword,
                    full_name: customer.full_name,
                    phone_number: customer.phone,
                    role: 'CUSTOMER',
                    email_verified: true,
                    phone_verified: true,
                }
            });
            console.log(`✅ ${customer.email}`);
        } catch (error) {
            console.error(`❌ Error creating ${customer.email}:`, error.message);
        }
    }

    console.log('\n✅ Customer accounts ready!');
    console.log('Password for all: password123\n');

    const count = await prisma.user.count({ where: { role: 'CUSTOMER' } });
    console.log(`Total customers in database: ${count}`);
}

createCustomers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
