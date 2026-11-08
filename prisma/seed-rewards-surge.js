const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Milestone Reward Rules, Referral Config, and Surge Areas...');

    // 1. Seed Milestone Reward Rules
    const existingRules = await prisma.partnerRewardRule.count();
    if (existingRules === 0) {
        await prisma.partnerRewardRule.createMany({
            data: [
                {
                    title: '4 Jobs or 4 Hours Daily Milestone',
                    target_jobs: 4,
                    target_hours: 4.0,
                    condition_type: 'OR',
                    reward_type: 'WALLET_MONEY',
                    reward_amount: 150,
                    cycle: 'DAILY',
                    is_active: true,
                },
                {
                    title: '8 Jobs or 8 Hours Daily Pro Milestone',
                    target_jobs: 8,
                    target_hours: 8.0,
                    condition_type: 'OR',
                    reward_type: 'WALLET_MONEY',
                    reward_amount: 350,
                    cycle: 'DAILY',
                    is_active: true,
                },
            ],
        });
        console.log('✅ Created default 4-job/hour and 8-job/hour milestone reward rules');
    } else {
        console.log(`ℹ️ Milestone rules already exist (${existingRules})`);
    }

    // 2. Seed Referral Config
    const existingRefConfig = await prisma.referralConfig.findFirst();
    if (!existingRefConfig) {
        await prisma.referralConfig.create({
            data: {
                customer_referrer_reward: 100,
                customer_referee_reward: 100,
                partner_referrer_reward: 1000,
                partner_qualifying_jobs: 5,
                partner_referee_reward: 500,
                is_active: true,
            },
        });
        console.log('✅ Created default Referral Configuration');
    } else {
        console.log('ℹ️ Referral configuration already exists');
    }

    // 3. Seed Sample Surge Areas
    const existingSurge = await prisma.surgeArea.count();
    if (existingSurge === 0) {
        await prisma.surgeArea.createMany({
            data: [
                {
                    name: 'Koramangala & HSR Sector 1-7',
                    city: 'Bengaluru',
                    latitude: 12.9279,
                    longitude: 77.6271,
                    radius_km: 6.0,
                    surge_multiplier: 1.4,
                    bonus_per_order: 50,
                    is_active: true,
                },
                {
                    name: 'Whitefield & Outer Ring Road Tech Corridor',
                    city: 'Bengaluru',
                    latitude: 12.9698,
                    longitude: 77.7499,
                    radius_km: 8.0,
                    surge_multiplier: 1.5,
                    bonus_per_order: 75,
                    is_active: true,
                },
                {
                    name: 'Indiranagar & Central Business District',
                    city: 'Bengaluru',
                    latitude: 12.9784,
                    longitude: 77.6408,
                    radius_km: 5.0,
                    surge_multiplier: 1.3,
                    bonus_per_order: 40,
                    is_active: true,
                },
            ],
        });
        console.log('✅ Created default Surge Areas');
    } else {
        console.log(`ℹ️ Surge areas already exist (${existingSurge})`);
    }

    console.log('🎉 Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

