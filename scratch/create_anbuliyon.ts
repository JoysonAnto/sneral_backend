import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'anbuliyon@gmail.com';
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);
    const categoryId = '2e6679a9-3e99-4343-aa4f-a8992d207046'; // Electrical Services

    console.log(`Starting creation/update for ${email}...`);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            full_name: 'Anbu Liyon',
            phone_number: '9840000000',
            role: 'SERVICE_PARTNER',
            email_verified: true,
            phone_verified: true
        },
        create: {
            email,
            password: hashedPassword,
            full_name: 'Anbu Liyon',
            phone_number: '9840000000',
            role: 'SERVICE_PARTNER',
            email_verified: true,
            phone_verified: true
        }
    });

    // Create/Update Service Partner details
    await prisma.servicePartner.upsert({
        where: { user_id: user.id },
        update: {
            category_id: categoryId,
            kyc_status: 'APPROVED',
            availability_status: 'AVAILABLE'
        },
        create: {
            user_id: user.id,
            category_id: categoryId,
            kyc_status: 'APPROVED',
            availability_status: 'AVAILABLE'
        }
    });

    // Create wallet
    await prisma.wallet.upsert({
        where: { user_id: user.id },
        update: {
            type: 'PROVIDER'
        },
        create: {
            user_id: user.id,
            balance: 500,
            type: 'PROVIDER'
        }
    });

    // Create profile
    await prisma.profile.upsert({
        where: { user_id: user.id },
        update: {
            city: 'Chennai',
            state: 'Tamil Nadu',
            country: 'India'
        },
        create: {
            user_id: user.id,
            city: 'Chennai',
            state: 'Tamil Nadu',
            country: 'India'
        }
    });

    console.log('Service Partner created/updated successfully with verified KYC:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${user.role}`);
    console.log(`KYC Status: APPROVED`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
