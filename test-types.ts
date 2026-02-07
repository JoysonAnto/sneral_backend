
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findFirst({
        include: {
            service_partner: true,
            profile: true
        }
    });
    console.log('User found:', !!user);
    if (user) {
        console.log('Service Partner:', !!(user as any).service_partner);
        console.log('Profile:', !!(user as any).profile);
    }
    process.exit(0);
}
main();
