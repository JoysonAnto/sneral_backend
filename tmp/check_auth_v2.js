const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { 
        OR: [
            { role: 'ADMIN' },
            { role: 'SUPER_ADMIN' }
        ]
    },
    include: {
      custom_role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  });

  console.log('--- ADMIN USES ---');
  for (const u of users) {
    const permissions = u.custom_role?.permissions.map(p => p.permission.name) || [];
    console.log(`Email: ${u.email}, Role: ${u.role}, Custom Role ID: ${u.role_id || 'NULL'}, Permissions: ${permissions.length}`);
  }

  const roleCount = await prisma.role.count();
  console.log(`\nTotal Roles in DB: ${roleCount}`);
  
  const permCount = await prisma.permission.count();
  console.log(`Total Permissions in DB: ${permCount}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
