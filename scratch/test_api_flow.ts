import axios from 'axios';

const API_URL = 'http://localhost:4000/api/v1';

async function testFlow() {
    const testUser = {
        email: `test_customer_${Date.now()}@example.com`,
        password: 'Password123!',
        fullName: 'Test Customer',
        phoneNumber: `90000${Math.floor(Math.random() * 100000)}`,
        role: 'CUSTOMER'
    };

    console.log('--- Step 1: Register ---');
    try {
        const regRes = await axios.post(`${API_URL}/auth/register`, testUser);
        console.log('Registration Response:', regRes.data);
        const otp = regRes.data.data.otp;

        console.log('\n--- Step 2: Verify OTP ---');
        const verifyRes = await axios.post(`${API_URL}/auth/verify-otp`, {
            email: testUser.email,
            otp: otp
        });
        console.log('Verification Response:', verifyRes.data);

        console.log('\n--- Step 3: Login ---');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log('Login Response:', loginRes.data);
        const token = loginRes.data.data.accessToken;

        console.log('\n--- Step 4: Fetch Categories ---');
        const catRes = await axios.get(`${API_URL}/public/categories`);
        console.log('Categories Count:', catRes.data.data.length);
        console.log('First Category:', catRes.data.data[0]?.name);

        console.log('\n--- Step 5: Test Profile ---');
        const profileRes = await axios.get(`${API_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Profile Wallet Balance:', profileRes.data.data.wallet?.balance);

        console.log('\n✅ ALL STEPS PASSED!');
    } catch (error: any) {
        console.error('❌ FLOW FAILED!');
        if (error.response) {
            console.error('Error Data:', error.response.data);
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

testFlow();
