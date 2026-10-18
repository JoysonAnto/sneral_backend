const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: 'e6ea5e3f-e7a9-4366-8c91-598cc82c1efd' },
      include: {
          items: {
              include: {
                  service: {
                      include: {
                          category: true,
                      },
                  },
              },
          },
          customer: {
              select: {
                  id: true,
                  email: true,
                  full_name: true,
                  phone_number: true,
                  profile: true,
              },
          },
          partner: {
              include: {
                  user: {
                      select: {
                          id: true,
                          email: true,
                          full_name: true,
                          phone_number: true,
                      },
                  },
              },
          },
          payments: true,
          rating: true,
          status_history: {
              orderBy: {
                  created_at: 'desc',
              },
          },
      },
    });
    console.log("Success:", !!booking);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
