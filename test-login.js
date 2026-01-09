// Simple admin login test
const axios = require('axios');
const API_URL = 'http://localhost:4000/api/v1';

async function testLogin() {
    try {
        console.log('Testing login...');
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@snearal.com',
            password: 'password123'
        });
        console.log('✅ Login successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Login failed');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

testLogin();
