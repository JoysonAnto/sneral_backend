import multer from 'multer';
import { Request } from 'express';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();

// File filter for images only
const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed.'));
    }
};

// Multer upload configuration for images (services, categories)
export const imageUpload = multer({
    storage: memoryStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: imageFilter,
});

// Single image upload
export const singleImageUpload = imageUpload.single('image');

// Service image upload
export const serviceImageUpload = imageUpload.single('serviceImage');

// Category icon upload
export const categoryIconUpload = imageUpload.single('categoryIcon');
