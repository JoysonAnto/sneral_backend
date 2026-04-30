import admin from 'firebase-admin';
import logger from '../utils/logger';

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK.
 * Reads credentials from the FIREBASE_SERVICE_ACCOUNT_KEY env variable
 * (which should be the full JSON object as a string) OR from individual
 * FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY vars.
 */
export function initializeFirebase(): void {
    if (firebaseInitialized || admin.apps.length > 0) {
        return;
    }

    try {
        // Option 1: Full service account JSON string in env
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            firebaseInitialized = true;
            logger.info('🔥 Firebase Admin SDK initialized via service account JSON');
            return;
        }

        // Option 2: Individual credential fields
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (projectId && clientEmail && privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            firebaseInitialized = true;
            logger.info('🔥 Firebase Admin SDK initialized via individual env vars');
            return;
        }

        logger.warn('⚠️  Firebase credentials not found. Push notifications will be disabled.');
    } catch (error) {
        logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
    }
}

/**
 * Get the Firebase Messaging instance.
 * Returns null if Firebase is not initialized.
 */
export function getFirebaseMessaging(): admin.messaging.Messaging | null {
    if (admin.apps.length === 0) {
        return null;
    }
    return admin.messaging();
}

export default admin;
