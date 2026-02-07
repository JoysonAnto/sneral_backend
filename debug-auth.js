const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function debugAuth() {
    try {
        const email = 'rajesh.kumar@gmail.com';
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            console.log('User not found');
            return;
        }

        console.log(`User: ${user.email}`);
        console.log(`Hashed Password in DB: ${user.password}`);

        const isMatch = await bcrypt.compare('password123', user.password);
        console.log(`Does 'password123' match? ${isMatch}`);

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

debugAuth();
