import axios from 'axios';

async function test() {
    try {
        const loginRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
            email: 'admin@snearal.com',
            password: 'password123'
        });
        const token = loginRes.data.data.accessToken;
        console.log('Login Successful, Token:', token);

        const statsRes = await axios.get('http://localhost:4000/api/v1/admin/dashboard/stats', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Stats Response:', JSON.stringify(statsRes.data, null, 2));

        const bookingsRes = await axios.get('http://localhost:4000/api/v1/bookings', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Bookings Count:', bookingsRes.data.data.length);

    } catch (error: any) {
        console.error('Test Failed:', error.response?.data || error.message);
    }
}

test();
