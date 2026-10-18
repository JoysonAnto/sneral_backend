import request from 'supertest';
import app from './src/app';
import path from 'path';
import fs from 'fs';

interface TestResult {
    suite: string;
    name: string;
    passed: boolean;
    durationMs: number;
    details?: string;
    error?: string;
}

const results: TestResult[] = [];

async function runStep(suite: string, name: string, fn: () => Promise<any>): Promise<any> {
    const start = Date.now();
    try {
        const res = await fn();
        const durationMs = Date.now() - start;
        results.push({ suite, name, passed: true, durationMs, details: res ? JSON.stringify(res).substring(0, 150) : 'OK' });
        console.log(`  ✅ [PASS] ${name} (${durationMs}ms)`);
        return res;
    } catch (err: any) {
        const durationMs = Date.now() - start;
        const msg = err.response?.text || err.message || String(err);
        results.push({ suite, name, passed: false, durationMs, error: msg });
        console.error(`  ❌ [FAIL] ${name} (${durationMs}ms): ${msg}`);
        return null;
    }
}

async function runAllTests() {
    console.log('\n======================================================');
    console.log('🚀 SNEARAL UNIFIED BACKEND - COMPREHENSIVE FLOW AUDIT');
    console.log('======================================================\n');

    let adminToken = '';
    let spToken = '';
    let custToken = '';
    let partnerId = '';
    let uploadedDocPath = '';
    let uploadedDocId = '';
    let testBookingId = '';

    // ─────────────────────────────────────────────────────────
    // 1. HEALTH & DOCUMENTATION SUITE
    // ─────────────────────────────────────────────────────────
    console.log('\n--- 1. Health & Documentation APIs ---');
    
    await runStep('Docs & Health', 'GET /health', async () => {
        const res = await request(app).get('/api/v1/health').expect(200);
        if (res.body.status !== 'OK') throw new Error('Health status not OK');
        return res.body;
    });

    await runStep('Docs & Health', 'GET / (Root API Info)', async () => {
        const res = await request(app).get('/').expect(200);
        if (!res.body.docs) throw new Error('Root endpoint missing docs link');
        return res.body;
    });

    await runStep('Docs & Health', 'GET /api/v1/docs.json (Swagger OpenAPI Spec)', async () => {
        const res = await request(app).get('/api/v1/docs.json').expect(200);
        if (!res.body.openapi || !res.body.info) throw new Error('Invalid OpenAPI specification object');
        if (!res.body.paths['/kyc/submit']) throw new Error('OpenAPI missing /kyc/submit endpoint');
        return { title: res.body.info.title, version: res.body.info.version, pathsCount: Object.keys(res.body.paths).length };
    });

    await runStep('Docs & Health', 'GET /api/v1/docs/ (Swagger UI HTML page)', async () => {
        const res = await request(app).get('/api/v1/docs/').expect(200);
        if (!res.text.includes('Swagger UI') && !res.text.includes('swagger')) {
            throw new Error('Swagger UI page does not contain swagger markup');
        }
        return { status: 'HTML Page Served' };
    });

    // ─────────────────────────────────────────────────────────
    // 2. AUTHENTICATION & RBAC
    // ─────────────────────────────────────────────────────────
    console.log('\n--- 2. Authentication & Role-Based Access ---');

    await runStep('Auth', 'Login Admin (admin@snearal.com)', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'admin@snearal.com', password: 'password123' })
            .expect(200);
        adminToken = res.body.data.accessToken || res.body.data.access_token;
        if (!adminToken) throw new Error('Missing accessToken in admin login response');
        return { role: res.body.data.user.role };
    });

    await runStep('Auth', 'Login Service Partner (ramesh.electrician@service.com)', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'ramesh.electrician@service.com', password: 'password123' })
            .expect(200);
        spToken = res.body.data.accessToken || res.body.data.access_token;
        if (!spToken) throw new Error('Missing accessToken in SP login response');
        return { role: res.body.data.user.role };
    });

    await runStep('Auth', 'Login Customer (rajesh.kumar@gmail.com)', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'rajesh.kumar@gmail.com', password: 'password123' })
            .expect(200);
        custToken = res.body.data.accessToken || res.body.data.access_token;
        if (!custToken) throw new Error('Missing accessToken in customer login response');
        return { role: res.body.data.user.role };
    });

    await runStep('Auth', 'Verify Profile GET /api/v1/auth/me (Partner)', async () => {
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${spToken}`)
            .expect(200);
        if (res.body.data.role !== 'SERVICE_PARTNER') throw new Error('Wrong role returned');
        return { name: res.body.data.full_name, role: res.body.data.role };
    });

    await runStep('Auth', 'Reject Unauthenticated Protected Route (401)', async () => {
        await request(app)
            .get('/api/v1/kyc/me')
            .expect(401);
        return { status: 'Correctly rejected with 401' };
    });

    // ─────────────────────────────────────────────────────────
    // 3. PUBLIC & CATALOG APIS
    // ─────────────────────────────────────────────────────────
    console.log('\n--- 3. Public Catalog & Location Services ---');

    await runStep('Catalog', 'GET /api/v1/services (Public Services)', async () => {
        const res = await request(app).get('/api/v1/services').expect(200);
        const list = res.body.data || res.body;
        if (!Array.isArray(list) || list.length === 0) throw new Error('No services returned');
        return { count: list.length, sample: list[0].name };
    });

    await runStep('Catalog', 'GET /api/v1/public/categories', async () => {
        const res = await request(app).get('/api/v1/public/categories').expect(200);
        const list = res.body.data;
        if (!Array.isArray(list) || list.length === 0) throw new Error('No categories returned');
        return { count: list.length };
    });

    await runStep('Catalog', 'GET /api/v1/public/locations/states', async () => {
        const res = await request(app).get('/api/v1/public/locations/states').expect(200);
        return { states: res.body.data };
    });

    // ─────────────────────────────────────────────────────────
    // 4. KYC DOCUMENT SUBMISSION & VERIFICATION FLOW
    // ─────────────────────────────────────────────────────────
    console.log('\n--- 4. KYC Documents & Verification Workflow ---');

    await runStep('KYC Flow', 'Check Initial KYC Status (GET /api/v1/kyc/me)', async () => {
        const res = await request(app)
            .get('/api/v1/kyc/me')
            .set('Authorization', `Bearer ${spToken}`)
            .expect(200);
        return { status: res.body.data.status };
    });

    // Create dummy files for multipart upload test
    const dummyDir = path.join(process.cwd(), 'tmp', 'test-docs');
    fs.mkdirSync(dummyDir, { recursive: true });
    const aadhaarFrontFile = path.join(dummyDir, 'aadhaar_front.png');
    const aadhaarBackFile = path.join(dummyDir, 'aadhaar_back.png');
    const panFile = path.join(dummyDir, 'pan_card.png');
    const bankFile = path.join(dummyDir, 'bank_passbook.png');
    fs.writeFileSync(aadhaarFrontFile, Buffer.from('FAKE_PNG_AADHAAR_FRONT'));
    fs.writeFileSync(aadhaarBackFile, Buffer.from('FAKE_PNG_AADHAAR_BACK'));
    fs.writeFileSync(panFile, Buffer.from('FAKE_PNG_PAN'));
    fs.writeFileSync(bankFile, Buffer.from('FAKE_PNG_BANK_PASSBOOK'));

    await runStep('KYC Flow', 'Submit KYC Documents (POST /api/v1/kyc/submit)', async () => {
        const res = await request(app)
            .post('/api/v1/kyc/submit')
            .set('Authorization', `Bearer ${spToken}`)
            .attach('aadhaar_front', aadhaarFrontFile)
            .attach('aadhaar_back', aadhaarBackFile)
            .attach('pan_card', panFile)
            .attach('bank_passbook', bankFile)
            .expect(201);

        if (res.body.data.status !== 'PENDING_VERIFICATION') {
            throw new Error(`Expected PENDING_VERIFICATION, got ${res.body.data.status}`);
        }
        return res.body.data;
    });

    await runStep('KYC Flow', 'Verify Status Updated to PENDING_VERIFICATION (GET /api/v1/kyc/me)', async () => {
        const res = await request(app)
            .get('/api/v1/kyc/me')
            .set('Authorization', `Bearer ${spToken}`)
            .expect(200);

        if (res.body.data.status !== 'PENDING_VERIFICATION') {
            throw new Error(`Status is not PENDING_VERIFICATION: ${res.body.data.status}`);
        }
        if (!res.body.data.documents || res.body.data.documents.length === 0) {
            throw new Error('No documents found in KYC status');
        }

        uploadedDocPath = res.body.data.documents[0].url;
        uploadedDocId = res.body.data.documents[0].id;
        return {
            status: res.body.data.status,
            documentsCount: res.body.data.documents.length,
            firstDocType: res.body.data.documents[0].type
        };
    });

    await runStep('KYC Flow', 'Static File Access: GET uploaded KYC document', async () => {
        if (!uploadedDocPath) throw new Error('No uploaded document path to test');
        const res = await request(app).get(uploadedDocPath).expect(200);
        return { contentType: res.headers['content-type'], length: res.body.length || res.text?.length };
    });

    await runStep('KYC Flow', 'Admin: Get KYC Stats (GET /api/v1/kyc/stats)', async () => {
        const res = await request(app)
            .get('/api/v1/kyc/stats')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        if (typeof res.body.data.pending_verification !== 'number') {
            throw new Error('Invalid KYC stats response');
        }
        return res.body.data;
    });

    await runStep('KYC Flow', 'Admin: List Pending KYC Applications (GET /api/v1/kyc/pending)', async () => {
        const res = await request(app)
            .get('/api/v1/kyc/pending')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const data = res.body.data;
        if (!data || !Array.isArray(data.documents)) {
            throw new Error('Pending KYCs response missing documents list');
        }
        const found = data.documents.find((d: any) => d.partner?.email === 'ramesh.electrician@service.com');
        if (!found) {
            throw new Error('Submitted partner not found in pending list');
        }
        partnerId = found.partner.id;
        return { totalPending: data.total, partnerFound: found.partner.full_name };
    });

    await runStep('KYC Flow', 'Admin: Approve Single Document (PATCH /api/v1/kyc/:id/approve)', async () => {
        if (!uploadedDocId) throw new Error('No uploaded document id');
        const res = await request(app)
            .patch(`/api/v1/kyc/${uploadedDocId}/approve`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        return res.body.data;
    });

    await runStep('KYC Flow', 'Admin: Verify & Approve Partner KYC (POST /api/v1/kyc/:partnerId/verify)', async () => {
        const res = await request(app)
            .post(`/api/v1/kyc/${partnerId}/verify`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'APPROVED' })
            .expect(200);
        if (res.body.data.status !== 'APPROVED') {
            throw new Error(`Expected APPROVED, got ${res.body.data.status}`);
        }
        return res.body.data;
    });

    await runStep('KYC Flow', 'Partner: Confirm Final Approved Status (GET /api/v1/kyc/me)', async () => {
        const res = await request(app)
            .get('/api/v1/kyc/me')
            .set('Authorization', `Bearer ${spToken}`)
            .expect(200);

        if (res.body.data.status !== 'APPROVED') {
            throw new Error(`Expected partner status APPROVED, received: ${res.body.data.status}`);
        }
        return { status: res.body.data.status, verifiedAt: res.body.data.verifiedAt };
    });

    await runStep('KYC Flow', 'Instant PAN Verification (POST /api/v1/kyc/verify-pan)', async () => {
        const res = await request(app)
            .post('/api/v1/kyc/verify-pan')
            .set('Authorization', `Bearer ${spToken}`)
            .send({ panNumber: 'ABCDE1234F', fullName: 'Ramesh Electrician' })
            .expect(200);
        return res.body.data;
    });

    await runStep('KYC Flow', 'Instant Bank Verification (POST /api/v1/kyc/verify-bank)', async () => {
        const res = await request(app)
            .post('/api/v1/kyc/verify-bank')
            .set('Authorization', `Bearer ${spToken}`)
            .send({ accountNumber: '123456789012', ifscCode: 'SBIN0001234' })
            .expect(200);
        return res.body.data;
    });

    // ─────────────────────────────────────────────────────────
    // 5. BOOKING LIFECYCLE FLOW
    // ─────────────────────────────────────────────────────────
    console.log('\n--- 5. Booking Lifecycle Workflow ---');

    await runStep('Bookings', 'Customer: List existing bookings (GET /api/v1/bookings)', async () => {
        const res = await request(app)
            .get('/api/v1/bookings')
            .set('Authorization', `Bearer ${custToken}`)
            .expect(200);
        const list = res.body.data;
        if (Array.isArray(list) && list.length > 0) {
            testBookingId = list[0].id;
            return { count: list.length, sampleStatus: list[0].status };
        }
        return { count: 0 };
    });

    await runStep('Bookings', 'Get Details of Booking (GET /api/v1/bookings/:id)', async () => {
        if (!testBookingId) return { skipped: true };
        const res = await request(app)
            .get(`/api/v1/bookings/${testBookingId}`)
            .set('Authorization', `Bearer ${custToken}`)
            .expect(200);
        return { id: res.body.data.id, status: res.body.data.status, total: res.body.data.total_amount };
    });

    // ─────────────────────────────────────────────────────────
    // 6. WALLET & ADMIN DASHBOARD
    // ─────────────────────────────────────────────────────────
    console.log('\n--- 6. Wallet & Admin Dashboard ---');

    await runStep('Wallet', 'Customer: Check Wallet Balance (GET /api/v1/wallet/balance)', async () => {
        const res = await request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer ${custToken}`)
            .expect(200);
        return res.body.data;
    });

    await runStep('Admin', 'Admin: Get Dashboard Stats (GET /api/v1/admin/dashboard/stats)', async () => {
        const res = await request(app)
            .get('/api/v1/admin/dashboard/stats')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        return {
            users: res.body.data.totalUsers,
            bookings: res.body.data.totalBookings,
            revenue: res.body.data.totalRevenue
        };
    });

    await runStep('Admin', 'Admin: Get Platform Settings (GET /api/v1/admin/settings)', async () => {
        const res = await request(app)
            .get('/api/v1/admin/settings')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        return res.body.data;
    });

    await runStep('Admin', 'Admin: List Users (GET /api/v1/users)', async () => {
        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        return { total: res.body.data?.length || res.body.data?.total || 0 };
    });

    await runStep('Admin', 'Admin: List Partners (GET /api/v1/partners)', async () => {
        const res = await request(app)
            .get('/api/v1/partners')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        return { total: res.body.data?.length || res.body.data?.total || 0 };
    });

    // Clean up temporary dummy files
    try {
        fs.rmSync(dummyDir, { recursive: true, force: true });
    } catch {}

    // ─────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────
    console.log('\n======================================================');
    console.log('📊 FINAL TEST RESULTS AUDIT');
    console.log('======================================================');
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`TOTAL TESTS: ${results.length}`);
    console.log(`PASSED:      ${passedCount}`);
    console.log(`FAILED:      ${failedCount}`);
    console.log('======================================================\n');

    if (failedCount > 0) {
        console.error('❌ Failed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.error(`  - [${r.suite}] ${r.name}: ${r.error}`);
        });
        process.exit(1);
    } else {
        console.log('🎉 ALL API ENDPOINTS AND DOCUMENT FLOWS VERIFIED SUCCESSFULLY!');
        process.exit(0);
    }
}

runAllTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
