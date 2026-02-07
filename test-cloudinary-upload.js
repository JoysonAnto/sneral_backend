/**
 * Test script for Cloudinary image upload integration
 * 
 * This script tests:
 * 1. Service image upload via API
 * 2. Category icon upload via API
 * 3. Cloudinary URL verification
 * 
 * Usage: node test-cloudinary-upload.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:4000/api/v1';

// Replace with actual admin token from LOGIN_CREDENTIALS.md
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE';

async function testServiceImageUpload() {
    console.log('\n🧪 Testing Service Image Upload...\n');

    try {
        // Create a test image file (1x1 pixel PNG)
        const testImagePath = path.join(__dirname, 'test-service-image.png');
        const pngBuffer = Buffer.from(
            'iVBORw0KG goAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
        );
        fs.writeFileSync(testImagePath, pngBuffer);

        const form = new FormData();
        form.append('name', 'Cloudinary Test Service');
        form.append('categoryId', '<CATEGORY_UUID_HERE>'); // Replace with actual category ID
        form.append('basePrice', '599');
        form.append('duration', '60');
        form.append('description', 'Testing Cloudinary integration');
        form.append('serviceImage', fs.createReadStream(testImagePath));

        const response = await axios.post(
            `${API_BASE_URL}/services`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${ADMIN_TOKEN}`,
                },
            }
        );

        console.log('✅ Service created successfully!');
        console.log('Service ID:', response.data.data.id);
        console.log('Image URL:', response.data.data.image_url);

        // Verify it's a Cloudinary URL
        if (response.data.data.image_url?.includes('cloudinary.com')) {
            console.log('✅ Image uploaded to Cloudinary successfully!');
        } else {
            console.log('❌ Image URL is not from Cloudinary');
        }

        // Clean up
        fs.unlinkSync(testImagePath);

        return response.data.data;
    } catch (error) {
        console.error('❌ Service upload failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

async function testCategoryIconUpload() {
    console.log('\n🧪 Testing Category Icon Upload...\n');

    try {
        const testIconPath = path.join(__dirname, 'test-category-icon.png');
        const pngBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
        );
        fs.writeFileSync(testIconPath, pngBuffer);

        const form = new FormData();
        form.append('name', 'Cloudinary Test Category');
        form.append('description', 'Testing Cloudinary icon upload');
        form.append('categoryIcon', fs.createReadStream(testIconPath));

        const response = await axios.post(
            `${API_BASE_URL}/services/categories`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${ADMIN_TOKEN}`,
                },
            }
        );

        console.log('✅ Category created successfully!');
        console.log('Category ID:', response.data.data.id);
        console.log('Icon URL:', response.data.data.icon_url);

        if (response.data.data.icon_url?.includes('cloudinary.com')) {
            console.log('✅ Icon uploaded to Cloudinary successfully!');
        } else {
            console.log('❌ Icon URL is not from Cloudinary');
        }

        // Clean up
        fs.unlinkSync(testIconPath);

        return response.data.data;
    } catch (error) {
        console.error('❌ Category upload failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

async function runTests() {
    console.log('═══════════════════════════════════════');
    console.log('🚀 Cloudinary Integration Test Suite');
    console.log('═══════════════════════════════════════');

    // Test 1: Service Image Upload
    await testServiceImageUpload();

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Category Icon Upload
    await testCategoryIconUpload();

    console.log('\n═══════════════════════════════════════');
    console.log('✅ All tests completed!');
    console.log('═══════════════════════════════════════\n');
}

// Run the tests
runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
