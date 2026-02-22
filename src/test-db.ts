import prisma from './config/database';

async function main() {
    console.log('Attempting to connect to DB...');
    try {
        await prisma.$connect();
        console.log('✅ Connection successful!');
        const count = await prisma.user.count();
        console.log('User count:', count);
    } catch (error) {
        console.error('❌ Connection failed:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
