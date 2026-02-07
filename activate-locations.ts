import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function activate() {
    await prisma.district.updateMany({
        data: { is_active: true }
    });
    await prisma.state.updateMany({
        data: { is_active: true }
    });
    await prisma.area.updateMany({
        data: { is_active: true }
    });
    console.log('Districts, States, and Areas activated');
    await prisma.$disconnect();
}

activate();
