const { execSync } = require('child_process');
const path = require('path');

const scripts = [
    'prisma/seed.js', // Customers, Categories, Services
    'add-admin-users.js',
    'add-business-partner.js',
    'add-service-partners.js',
    'reset-passwords.js'
];

console.log('🚀 Starting Master Seed Execution...\n');

for (const script of scripts) {
    console.log(`➡️ Running: ${script}...`);
    try {
        const output = execSync(`node ${script}`, { cwd: __dirname }).toString();
        console.log(`✅ Success: ${script}`);
        // console.log(output);
    } catch (error) {
        console.warn(`⚠️ Warning/Error in ${script}:`, error.message);
        if (error.stdout) console.log(error.stdout.toString());
        if (error.stderr) console.log(error.stderr.toString());
    }
}

console.log('\n✨ All seed scripts processed.');
