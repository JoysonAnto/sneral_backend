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

// Service image upload - accepts 'serviceImage', 'image', 'file', 'service_image', etc.
export const serviceImageUpload = (req: any, res: any, next: any) => {
    imageUpload.any()(req, res, (err: any) => {
        if (err) return next(err);
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            req.file = req.files.find((f: any) =>
                ['serviceImage', 'image', 'file', 'service_image', 'imageUrl', 'image_url', 'photo'].includes(f.fieldname)
            ) || req.files[0];
        }
        next();
    });
};

// Category icon upload - accepts 'categoryIcon', 'icon', 'image', 'file', 'category_icon', etc.
export const categoryIconUpload = (req: any, res: any, next: any) => {
    imageUpload.any()(req, res, (err: any) => {
        if (err) return next(err);
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            req.file = req.files.find((f: any) =>
                ['categoryIcon', 'icon', 'image', 'file', 'category_icon', 'iconUrl', 'icon_url'].includes(f.fieldname)
            ) || req.files[0];
        }
        next();
    });
};
