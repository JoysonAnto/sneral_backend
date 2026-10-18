import dotenv from 'dotenv';
dotenv.config();

import prisma from './src/config/database';
import { initializeFirebase, getFirebaseMessaging } from './src/config/firebase';
import googleMapsService from './src/services/google-maps.service';
import { v2 as cloudinary } from 'cloudinary';
import redisClient from './src/config/redis';

interface ServiceCheck {
    name: string;
    envVars: string[];
    status: 'ACTIVE' | 'PARTIAL' | 'MISSING' | 'ERROR';
    details: string;
}

async function runCredentialsCheck() {
    console.log('\n=============================================================');
    console.log('       SNEARAL BACKEND - CREDENTIALS & INTEGRATION AUDIT     ');
    console.log('=============================================================\n');

    const results: ServiceCheck[] = [];

    // 1. PostgreSQL Database
    try {
        await prisma.$queryRaw`SELECT 1`;
        results.push({
            name: 'PostgreSQL Database',
            envVars: ['DATABASE_URL'],
            status: 'ACTIVE',
            details: 'Successfully connected and executed query on port 5432 (snearal DB)',
        });
    } catch (e: any) {
        results.push({
            name: 'PostgreSQL Database',
            envVars: ['DATABASE_URL'],
            status: 'ERROR',
            details: e.message,
        });
    }

    // 2. Redis Cache
    try {
        if (redisClient) {
            await redisClient.ping();
            results.push({
                name: 'Redis Cache',
                envVars: ['REDIS_HOST', 'REDIS_PORT'],
                status: 'ACTIVE',
                details: 'Successfully pinged Redis on ' + (process.env.REDIS_HOST || 'localhost') + ':' + (process.env.REDIS_PORT || 6379),
            });
        } else {
            results.push({
                name: 'Redis Cache',
                envVars: ['REDIS_HOST', 'REDIS_PORT'],
                status: 'PARTIAL',
                details: 'Redis client disabled or not configured',
            });
        }
    } catch (e: any) {
        results.push({
            name: 'Redis Cache',
            envVars: ['REDIS_HOST', 'REDIS_PORT'],
            status: 'ERROR',
            details: e.message,
        });
    }

    // 3. Firebase Admin SDK / Push Notifications
    try {
        initializeFirebase();
        const fcm = getFirebaseMessaging();
        if (fcm) {
            results.push({
                name: 'Firebase Admin SDK (FCM)',
                envVars: ['FIREBASE_SERVICE_ACCOUNT_KEY'],
                status: 'ACTIVE',
                details: 'Initialized via Service Account for project ' + (process.env.FIREBASE_PROJECT_ID || 'snearal-f2f31'),
            });
        } else {
            results.push({
                name: 'Firebase Admin SDK (FCM)',
                envVars: ['FIREBASE_SERVICE_ACCOUNT_KEY'],
                status: 'MISSING',
                details: 'Firebase Messaging not initialized',
            });
        }
    } catch (e: any) {
        results.push({
            name: 'Firebase Admin SDK (FCM)',
            envVars: ['FIREBASE_SERVICE_ACCOUNT_KEY'],
            status: 'ERROR',
            details: e.message,
        });
    }

    // 4. Google Maps API
    try {
        if (process.env.GOOGLE_MAPS_API_KEY) {
            const geo = await googleMapsService.geocodeAddress('Chennai, Tamil Nadu, India');
            if (geo) {
                results.push({
                    name: 'Google Maps Platform',
                    envVars: ['GOOGLE_MAPS_API_KEY'],
                    status: 'ACTIVE',
                    details: 'Geocoding active: ' + geo.formattedAddress,
                });
            } else {
                results.push({
                    name: 'Google Maps Platform',
                    envVars: ['GOOGLE_MAPS_API_KEY'],
                    status: 'ERROR',
                    details: 'Geocoding returned empty result',
                });
            }
        } else {
            results.push({
                name: 'Google Maps Platform',
                envVars: ['GOOGLE_MAPS_API_KEY'],
                status: 'MISSING',
                details: 'GOOGLE_MAPS_API_KEY is not set',
            });
        }
    } catch (e: any) {
        results.push({
            name: 'Google Maps Platform',
            envVars: ['GOOGLE_MAPS_API_KEY'],
            status: 'ERROR',
            details: e.message,
        });
    }

    // 5. Cloudinary
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        try {
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
            });
            const ping = await cloudinary.api.ping();
            results.push({
                name: 'Cloudinary Media Storage',
                envVars: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
                status: ping?.status === 'ok' ? 'ACTIVE' : 'PARTIAL',
                details: 'Connected to cloud: ' + process.env.CLOUDINARY_CLOUD_NAME,
            });
        } catch (e: any) {
            results.push({
                name: 'Cloudinary Media Storage',
                envVars: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
                status: 'ERROR',
                details: e.message,
            });
        }
    } else {
        results.push({
            name: 'Cloudinary Media Storage',
            envVars: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
            status: 'MISSING',
            details: 'Requires Cloudinary credentials for media upload',
        });
    }

    // 6. Razorpay
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        results.push({
            name: 'Razorpay Payment Gateway',
            envVars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
            status: 'ACTIVE',
            details: 'Key configured (ID starts with ' + process.env.RAZORPAY_KEY_ID.substring(0, 8) + '...)',
        });
    } else {
        results.push({
            name: 'Razorpay Payment Gateway',
            envVars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
            status: 'MISSING',
            details: 'Requires Test or Live Razorpay API Keys',
        });
    }

    // 7. Cashfree
    if (process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET) {
        results.push({
            name: 'Cashfree PG & KYC Suite',
            envVars: ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET', 'CASHFREE_ENV'],
            status: 'ACTIVE',
            details: 'Configured for environment: ' + (process.env.CASHFREE_ENV || 'sandbox'),
        });
    } else {
        results.push({
            name: 'Cashfree PG & KYC Suite',
            envVars: ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET'],
            status: 'MISSING',
            details: 'Requires Cashfree App ID and Secret',
        });
    }

    // 8. Elastic Email
    if (process.env.ELASTIC_EMAIL_API_KEY) {
        results.push({
            name: 'Elastic Email (Transactional)',
            envVars: ['ELASTIC_EMAIL_API_KEY', 'EMAIL_FROM'],
            status: 'ACTIVE',
            details: 'Configured with sender: ' + (process.env.EMAIL_FROM || 'noreply@snearal.com'),
        });
    } else {
        results.push({
            name: 'Elastic Email (Transactional)',
            envVars: ['ELASTIC_EMAIL_API_KEY'],
            status: 'MISSING',
            details: 'Requires Elastic Email API Key for OTP & notification emails',
        });
    }

    // 9. Sentry APM
    if (process.env.SENTRY_DSN) {
        results.push({
            name: 'Sentry Error Monitoring',
            envVars: ['SENTRY_DSN'],
            status: 'ACTIVE',
            details: 'DSN configured',
        });
    } else {
        results.push({
            name: 'Sentry Error Monitoring',
            envVars: ['SENTRY_DSN'],
            status: 'MISSING',
            details: 'Optional: SENTRY_DSN not configured',
        });
    }

    // Print Report
    console.log(
        results
            .map((r) => {
                const icon =
                    r.status === 'ACTIVE'
                        ? '✅'
                        : r.status === 'MISSING'
                        ? '⏳'
                        : r.status === 'PARTIAL'
                        ? '⚠️ '
                        : '❌';
                return `${icon} [${r.status}] ${r.name.padEnd(30)} : ${r.details}`;
            })
            .join('\n')
    );
    console.log('\n=============================================================\n');

    await prisma.$disconnect();
    process.exit(0);
}

runCredentialsCheck().catch((err) => {
    console.error('Fatal error running credentials check:', err);
    process.exit(1);
});
