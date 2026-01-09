// Comprehensive Integration Test Script
// This tests all backend APIs and Socket.IO integration

const axios = require('axios');
const io = require('socket.io-client');

const API_URL = 'http://localhost:4000/api/v1';
const SOCKET_URL = 'http://localhost:4000';

// Test results storage
const results = {
  passed: [],
  failed: [],
};

// Helper functions
const log = (message, type = 'info') => {
  const prefix = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  }[type];
  console.log(`${prefix} ${message}`);
};

const test = async (name, fn) => {
  try {
    await fn();
    results.passed.push(name);
    log(`PASS: ${name}`, 'success');
  } catch (error) {
    results.failed.push({ name, error: error.message });
    log(`FAIL: ${name} - ${error.message}`, 'error');
  }
};

// Test data
let testUser = {
  email: `test${Date.now()}@example.com`,
  password: 'Test123!@#',
  fullName: 'Test User',
  role: 'CUSTOMER',
};

let accessToken = null;
let refreshToken = null;
let userId = null;
let bookingId = null;
let serviceId = null;

// ==================
// AUTHENTICATION TESTS
// ==================

async function testAuth() {
  log('\n=== Testing Authentication APIs ===\n', 'info');

  await test('POST /auth/register - Register new user', async () => {
    const response = await axios.post(`${API_URL}/auth/register`, testUser);
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
    userId = response.data.data.userId;
  });

  await test('POST /auth/login - Login with credentials', async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password,
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    accessToken = response.data.data.accessToken;
    refreshToken = response.data.data.refreshToken;
    if (!accessToken) throw new Error('No access token received');
  });

  await test('GET /auth/profile - Get user profile', async () => {
    const response = await axios.get(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.data.email !== testUser.email) throw new Error('Profile email mismatch');
  });

  await test('POST /auth/refresh-token - Refresh access token', async () => {
    const response = await axios.post(`${API_URL}/auth/refresh-token`, {
      refreshToken,
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    const newAccessToken = response.data.data.accessToken;
    if (!newAccessToken) throw new Error('No new access token received');
  });
}

// ==================
// SERVICES TESTS
// ==================

async function testServices() {
  log('\n=== Testing Services APIs ===\n', 'info');

  await test('GET /services - Get all services', async () => {
    const response = await axios.get(`${API_URL}/services`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.data && response.data.data.length > 0) {
      serviceId = response.data.data[0].id;
    }
  });

  await test('GET /services/:id - Get service by ID', async () => {
    if (!serviceId) throw new Error('No service ID available - skipped');
    const response = await axios.get(`${API_URL}/services/${serviceId}`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('GET /services/categories - Get categories', async () => {
    const response = await axios.get(`${API_URL}/services/categories`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });
}

// ==================
// BOOKINGS TESTS
// ==================

async function testBookings() {
  log('\n=== Testing Bookings APIs ===\n', 'info');

  await test('POST /bookings - Create booking', async () => {
    if (!serviceId) {
      log('No service ID, skipping booking creation', 'warning');
      return;
    }

    const bookingData = {
      serviceId,
      items: [{ serviceId, quantity: 1 }],
      scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      address: '123 Test Street',
      latitude: 12.9716,
      longitude: 77.5946,
      paymentMethod: 'CASH',
      notes: 'Integration test booking',
    };

    const response = await axios.post(`${API_URL}/bookings`, bookingData, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
    bookingId = response.data.data.bookingId || response.data.data.id;
  });

  await test('GET /bookings - Get all bookings', async () => {
    const response = await axios.get(`${API_URL}/bookings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('GET /bookings/:id - Get booking by ID', async () => {
    if (!bookingId) throw new Error('No booking ID available - skipped');
    const response = await axios.get(`${API_URL}/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });
}

// ==================
// WALLET TESTS
// ==================

async function testWallet() {
  log('\n=== Testing Wallet APIs ===\n', 'info');

  await test('GET /wallet - Get wallet balance', async () => {
    const response = await axios.get(`${API_URL}/wallet`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('GET /wallet/transactions - Get transactions', async () => {
    const response = await axios.get(`${API_URL}/wallet/transactions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });
}

// ==================
// NOTIFICATIONS TESTS
// ==================

async function testNotifications() {
  log('\n=== Testing Notifications APIs ===\n', 'info');

  await test('GET /notifications - Get all notifications', async () => {
    const response = await axios.get(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });
}

// ==================
// SOCKET.IO TESTS
// ==================

async function testSocketIO() {
  log('\n=== Testing Socket.IO Connection ===\n', 'info');

  await test('Socket.IO - Connect to /customer namespace', () => {
    return new Promise((resolve, reject) => {
      const socket = io(`${SOCKET_URL}/customer`, {
        auth: { token: accessToken },
      });

      socket.on('connect', () => {
        log('Socket connected successfully', 'success');
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (error) => {
        reject(new Error(`Socket connection failed: ${error.message}`));
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket connection timeout'));
      }, 5000);
    });
  });
}

// ==================
// MAIN TEST RUNNER
// ==================

async function runTests() {
  console.log('🧪 Starting Unified Backend Integration Tests\n');
  console.log(`Backend URL: ${API_URL}`);
  console.log(`Socket URL: ${SOCKET_URL}\n`);

  try {
    await testAuth();
    await testServices();
    await testBookings();
    await testWallet();
    await testNotifications();
    await testSocketIO();

    // Print results
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`📝 Total: ${results.passed.length + results.failed.length}\n`);

    if (results.failed.length > 0) {
      console.log('Failed tests:');
      results.failed.forEach(({ name, error }) => {
        console.log(`  ❌ ${name}`);
        console.log(`     ${error}\n`);
      });
    }

    console.log('\n✨ Integration test completed!');
    process.exit(results.failed.length);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
