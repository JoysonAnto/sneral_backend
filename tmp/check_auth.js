const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 10,
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

  console.log('--- USERS ---');
  users.forEach(u => {
    const permissions = u.custom_role?.permissions.map(p => p.permission.name) || [];
    console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Custom Role: ${u.custom_role?.name || 'NONE'}, Permissions: ${permissions.join(', ')}`);
  });

  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  console.log('\n--- ROLES ---');
  roles.forEach(r => {
    const permissions = r.permissions.map(p => p.permission.name) || [];
    console.log(`Role: ${r.name}, Permissions: ${permissions.join(', ')}`);
  });

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
