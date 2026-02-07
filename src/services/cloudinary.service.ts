import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryUploadResult {
    url: string;
    publicId: string;
    secureUrl: string;
    format: string;
    width?: number;
    height?: number;
}

class CloudinaryService {
    /**
     * Upload image buffer to Cloudinary
     */
    async uploadImage(
        buffer: Buffer,
        folder: string,
        filename?: string
    ): Promise<CloudinaryUploadResult> {
        try {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder,
                        public_id: filename,
                        resource_type: 'image',
                        transformation: [
                            { width: 1000, height: 1000, crop: 'limit' },
                            { quality: 'auto:good' },
                            { fetch_format: 'auto' },
                        ],
                    },
                    (error, result) => {
                        if (error) {
                            console.error('Cloudinary upload error:', error);
                            reject(error);
                        } else if (result) {
                            resolve({
                                url: result.url,
                                publicId: result.public_id,
                                secureUrl: result.secure_url,
                                format: result.format,
                                width: result.width,
                                height: result.height,
                            });
                        }
                    }
                );

                streamifier.createReadStream(buffer).pipe(uploadStream);
            });
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            throw new Error('Failed to upload image');
        }
    }

    /**
     * Upload service image
     */
    async uploadServiceImage(buffer: Buffer, serviceName: string): Promise<string> {
        const filename = `service_${serviceName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        const result = await this.uploadImage(buffer, 'snearal/services', filename);
        return result.secureUrl;
    }

    /**
     * Upload category icon
     */
    async uploadCategoryIcon(buffer: Buffer, categoryName: string): Promise<string> {
        const filename = `category_${categoryName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        const result = await this.uploadImage(buffer, 'snearal/categories', filename);
        return result.secureUrl;
    }

    /**
     * Delete image from Cloudinary
     */
    async deleteImage(publicId: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId);
            console.log(`Deleted image: ${publicId}`);
        } catch (error) {
            console.error('Error deleting from Cloudinary:', error);
            throw new Error('Failed to delete image');
        }
    }

    /**
     * Get image details
     */
    async getImageDetails(publicId: string): Promise<any> {
        try {
            const result = await cloudinary.api.resource(publicId);
            return result;
        } catch (error) {
            console.error('Error fetching image details:', error);
            throw new Error('Failed to get image details');
        }
    }
}

export default new CloudinaryService();
