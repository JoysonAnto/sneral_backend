import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'kyc');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

// File filter
const fileFilter = (_req: Request, _file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (allowedTypes.includes(_file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
};

// Multer upload configuration
export const kycUpload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter,
});

// Field configuration for KYC documents
export const kycFields = kycUpload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'bankProof', maxCount: 1 },
    { name: 'businessLicense', maxCount: 1 },
    { name: 'gstCertificate', maxCount: 1 },
]);

// Service photos storage
const servicePhotosDir = path.join(process.cwd(), 'uploads', 'service-photos');
if (!fs.existsSync(servicePhotosDir)) {
    fs.mkdirSync(servicePhotosDir, { recursive: true });
}

const servicePhotoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, servicePhotosDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

// Image file filter
const imageFileFilter = (_req: Request, _file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (allowedTypes.includes(_file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed.'));
    }
};

// Service photo upload configuration
export const servicePhotoUpload = multer({
    storage: servicePhotoStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for photos
    },
    fileFilter: imageFileFilter,
});

// Field configuration for service photos
export const beforeServicePhotos = servicePhotoUpload.array('before_images', 5); // Max 5 before images
export const afterServicePhotos = servicePhotoUpload.array('after_images', 5); // Max 5 after images
