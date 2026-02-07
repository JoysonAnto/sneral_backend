import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const transCount = await prisma.transaction.count();
    const walletCount = await prisma.wallet.count();
    const wallets = await prisma.wallet.findMany({ take: 5, orderBy: { balance: 'desc' } });

    console.log('Transactions:', transCount);
    console.log('Wallets:', walletCount);
    console.log('Top Wallets:', JSON.stringify(wallets, null, 2));

    await prisma.$disconnect();
}

check();
