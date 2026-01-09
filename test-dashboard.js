// Test just dashboard stats
const axios = require('axios');
const API_URL = 'http://localhost:4000/api/v1';

async function testDashboard() {
    try {
        // Login
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@snearal.com',
            password: 'password123'
        });
        const { accessToken } = loginResponse.data.data;
        console.log('✅ Login successful');

        // Get dashboard stats
        const statsResponse = await axios.get(`${API_URL}/admin/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log('✅ Dashboard stats retrieved!');
        console.log(JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
        console.error('❌ Error:');
        console.error(error.response?.data || error.message);
    }
}

testDashboard();
