const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function reset() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const emails = [
            'rajesh.kumar@gmail.com',
            'admin@snearal.com',
            'deepak.cleaner@service.com'
        ];

        for (const email of emails) {
            await prisma.user.update({
                where: { email },
                data: { password: hashedPassword }
            });
            console.log(`✅ Password reset for: ${email}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

reset();
