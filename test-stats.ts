import axios from 'axios';

async function testStats() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
            email: 'admin@snearal.com',
            password: 'password123'
        });

        const token = loginRes.data.data.accessToken;
        console.log('Login successful');

        console.log('Fetching dashboard stats...');
        const statsRes = await axios.get('http://localhost:4000/api/v1/admin/dashboard/stats', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Dashboard Stats Response:', JSON.stringify(statsRes.data, null, 2));

        console.log('Fetching users...');
        const usersRes = await axios.get('http://localhost:4000/api/v1/users', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Users Count:', usersRes.data.data.length);
        if (usersRes.data.data.length > 0) {
            console.log('Sample User:', JSON.stringify(usersRes.data.data[0], null, 2));
        }

        console.log('Fetching partners...');
        const partnersRes = await axios.get('http://localhost:4000/api/v1/partners', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Partners Count:', partnersRes.data.data.length);
        if (partnersRes.data.data.length > 0) {
            console.log('Sample Partner:', JSON.stringify(partnersRes.data.data[0], null, 2));
        }

    } catch (error: any) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testStats();
