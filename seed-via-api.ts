import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

async function seedData() {
    try {
        console.log('🚀 Starting API Seed Process...');

        // 1. Register Admin (if not exists) or Login
        let adminToken = '';
        try {
            console.log('Logging in admin...');
            const loginRes = await axios.post(`${API_BASE}/auth/login`, {
                email: 'admin@snearal.com',
                password: 'password123'
            });
            adminToken = loginRes.data.data.accessToken;
            console.log('✅ Admin logged in successfully.');
        } catch (e) {
            console.log('Admin not found or login failed, trying to create one via Prisma seed... (assuming super admin is needed)');
            // Note: In a real system, you'd have a root admin or super admin creation script.
            // For now we will just throw if we can't get an admin token to create services
            throw new Error('Please run `npm run seed` or `node add-admin-users.js` first to create an admin account.');
        }

        // 2. Create Category
        console.log('Creating Category...');
        let categoryId = '';
        try {
            const categoryRes = await axios.post(`${API_BASE}/services/categories`, {
                name: 'Demo Category ' + Date.now(),
                description: 'Demo category description',
                isActive: true
            }, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            categoryId = categoryRes.data.data.id;
            console.log(`✅ Category created: ${categoryId}`);
        } catch (e: any) {
            console.error('❌ Failed to create category:', e.response?.data || e.message);
            // Try fetching an existing category
            const cats = await axios.get(`${API_BASE}/services/categories`);
            if (cats.data.data && cats.data.data.length > 0) {
                categoryId = cats.data.data[0].id;
                console.log(`✅ Using existing category: ${categoryId}`);
            } else {
                throw new Error('No categories available to create a service.');
            }
        }

        // 3. Create Service
        console.log('Creating Service...');
        let serviceId = '';
        try {
            const serviceRes = await axios.post(`${API_BASE}/services`, {
                name: 'Demo Service ' + Date.now(),
                description: 'Demo service description',
                category: 'HOME_SERVICE', // Or maybe categoryId depending on the validation
                categoryId: categoryId,
                basePrice: 500,
                currency: 'INR',
                unit: 'per hour',
                duration: 120,
                isActive: true
            }, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            serviceId = serviceRes.data.data.id;
            console.log(`✅ Service created: ${serviceId}`);
        } catch (e: any) {
            console.error('❌ Failed to create service:', e.response?.data || e.message);
            const srvs = await axios.get(`${API_BASE}/services`);
            if (srvs.data.data && srvs.data.data.length > 0) {
                serviceId = srvs.data.data[0].id;
                console.log(`✅ Using existing service: ${serviceId}`);
            } else {
                throw new Error('No services available.');
            }
        }

        // 4. Register a Customer
        console.log('Registering Customer...');
        let customerToken = '';
        const customerEmail = `customer_${Date.now()}@example.com`;
        try {
            await axios.post(`${API_BASE}/auth/register`, {
                email: customerEmail,
                password: 'password123',
                fullName: 'Demo Customer',
                phoneNumber: '+91' + String(Date.now()).slice(-10),
                role: 'CUSTOMER'
            });
            console.log('✅ Customer registered.');
            const loginRes = await axios.post(`${API_BASE}/auth/login`, {
                email: customerEmail,
                password: 'password123'
            });
            customerToken = loginRes.data.data.accessToken;
            console.log('✅ Customer logged in successfully.');
        } catch (e: any) {
            console.error('❌ Failed to register/login customer:', e.response?.data || e.message);
            throw new Error('Customer flow failed.');
        }

        // 5. Create a Booking
        console.log('Creating Booking...');
        try {
            const bookingRes = await axios.post(`${API_BASE}/bookings`, {
                serviceId: serviceId,
                items: [
                    {
                        serviceId: serviceId,
                        quantity: 1
                    }
                ],
                scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                scheduledTime: '10:00',
                serviceAddress: '123 Demo St',
                serviceLatitude: 12.9716,
                serviceLongitude: 77.5946,
                paymentMethod: 'CASH',
                specialInstructions: 'Demo booking created via API'
            }, {
                headers: { Authorization: `Bearer ${customerToken}` }
            });
            console.log(`✅ Booking created successfully: ${bookingRes.data.data.bookingNumber}`);
        } catch (e: any) {
            console.error('❌ Failed to create booking:', e.response?.data || e.message);
        }

        console.log('🎉 API Seed Process Completed!');
    } catch (error: any) {
        console.error('❌ Seed Process Failed:', error.message);
    }
}

seedData();
