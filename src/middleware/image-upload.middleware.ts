import multer from 'multer';
import { Request } from 'express';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();

// File filter for images only
const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, WebP, and SVG images are allowed.'));
    }
};

// Multer upload configuration for images (services, categories)
export const imageUpload = multer({
    storage: memoryStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: imageFilter,
});

// Single image upload
export const singleImageUpload = imageUpload.single('image');

// Service image upload - accepts 'serviceImage', 'image', or 'file'
export const serviceImageUpload = (req: any, res: any, next: any) => {
    imageUpload.fields([
        { name: 'serviceImage', maxCount: 1 },
        { name: 'image', maxCount: 1 },
        { name: 'file', maxCount: 1 },
    ])(req, res, (err: any) => {
        if (err) return next(err);
        if (req.files) {
            req.file = req.files['serviceImage']?.[0] || req.files['image']?.[0] || req.files['file']?.[0];
        }
        next();
    });
};

// Category icon upload - accepts 'categoryIcon', 'icon', 'image', or 'file'
export const categoryIconUpload = (req: any, res: any, next: any) => {
    imageUpload.fields([
        { name: 'categoryIcon', maxCount: 1 },
        { name: 'icon', maxCount: 1 },
        { name: 'image', maxCount: 1 },
        { name: 'file', maxCount: 1 },
    ])(req, res, (err: any) => {
        if (err) return next(err);
        if (req.files) {
            req.file = req.files['categoryIcon']?.[0] || req.files['icon']?.[0] || req.files['image']?.[0] || req.files['file']?.[0];
        }
        next();
    });
};
