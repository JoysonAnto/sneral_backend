const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listJobs() {
    try {
        console.log('--- Current Jobs (Bookings) ---');
        const jobs = await prisma.booking.findMany({
            where: {
                partner: {
                    user: {
                        full_name: 'Deepak Sharma'
                    }
                }
            },
            include: {
                customer: {
                    select: { full_name: true, phone_number: true }
                },
                partner: {
                    include: {
                        user: {
                            select: { full_name: true }
                        }
                    }
                },
                items: {
                    include: {
                        service: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        if (jobs.length === 0) {
            console.log('No jobs found in the database.');
        } else {
            jobs.forEach(job => {
                const serviceName = job.items?.[0]?.service?.name || 'Unknown Service';
                const customerName = job.customer?.full_name || 'Unknown Customer';
                const partnerName = job.partner?.user?.full_name || 'Unassigned';

                console.log(`[${job.booking_number}] ${serviceName}`);
                console.log(`  Status: ${job.status}`);
                console.log(`  Customer: ${customerName} (${job.customer?.phone_number || 'N/A'})`);
                console.log(`  Partner: ${partnerName}`);
                console.log(`  Address: ${job.service_address}`);
                console.log(`  Scheduled: ${job.scheduled_date} ${job.scheduled_time}`);
                console.log(`  Amount: ₹${job.total_amount}`);
                console.log('------------------------------');
            });
        }
    } catch (error) {
        console.error('Error listing jobs:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listJobs();
