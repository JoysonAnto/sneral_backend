// Quick test script to check admin API
const axios = require('axios');

const API_URL = 'http://localhost:4000/api/v1';

async function testAdminAPI() {
    try {
        console.log('🧪 Testing Admin API Integration...\n');

        // Step 1: Login as admin
        console.log('1️⃣ Logging in as admin...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@snearal.com',
            password: 'password123'
        });

        const { accessToken, user } = loginResponse.data.data;
        console.log('✅ Login successful!');
        console.log(`   User: ${user.full_name} (${user.role})`);
        console.log(`   Token: ${accessToken.substring(0, 20)}...`);

        // Step 2: Get dashboard stats
        console.log('\n2️⃣ Fetching dashboard stats...');
        const statsResponse = await axios.get(`${API_URL}/admin/dashboard/stats`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const stats = statsResponse.data.data;
        console.log('✅ Dashboard stats retrieved!');
        console.log('   Stats:', JSON.stringify(stats, null, 2));

        // Step 3: Test other endpoints
        console.log('\n3️⃣ Testing users endpoint...');
        const usersResponse = await axios.get(`${API_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log(`✅ Users endpoint working! Found ${usersResponse.data.data.length} users`);

        console.log('\n✨ All tests passed! Admin API is working correctly.');

    } catch (error) {
        console.error('\n❌ Test failed:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${error.response.data.message || error.response.data.error?.message}`);
            console.error(`   Data:`, error.response.data);
        } else {
            console.error(`   Error: ${error.message}`);
        }
        process.exit(1);
    }
}

testAdminAPI();
