import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'kiruba@gmail.com';
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            full_name: 'Kiruba Karan',
            phone_number: '9876543210',
            role: 'CUSTOMER',
            email_verified: true,
            phone_verified: true
        },
        create: {
            email,
            password: hashedPassword,
            full_name: 'Kiruba Karan',
            phone_number: '9876543210',
            role: 'CUSTOMER',
            email_verified: true,
            phone_verified: true
        }
    });

    // Create wallet for the user if it doesn't exist
    await prisma.wallet.upsert({
        where: { user_id: user.id },
        update: {},
        create: {
            user_id: user.id,
            balance: 1000, // Give them some starting balance for testing
            type: 'CUSTOMER'
        }
    });

    // Create profile for the user if it doesn't exist
    await prisma.profile.upsert({
        where: { user_id: user.id },
        update: {
            address: '123 Main St',
            city: 'Chennai',
            state: 'Tamil Nadu',
            postal_code: '600001',
            country: 'India',
            gender: 'MALE'
        },
        create: {
            user_id: user.id,
            address: '123 Main St',
            city: 'Chennai',
            state: 'Tamil Nadu',
            postal_code: '600001',
            country: 'India',
            gender: 'MALE'
        }
    });

    console.log('User and Profile created/updated successfully:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Full Name: ${user.full_name}`);
    console.log(`Role: ${user.role}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
