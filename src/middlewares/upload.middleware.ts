import multer from 'multer';
import cloudinary from '../config/cloudinary.config';
import { AppError } from '../common/appError';
import { env } from '../config/env.config';
import { CLOUDINARY_FOLDERS, CloudinaryFolderPath } from '../common/constants/cloudinary-folders.constant';

// Memory Storage
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        'Only JPEG, PNG, WEBP and AVIF images are allowed!',
        'INVALID_FILE_TYPE'
      ) as any
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter,
});

// Upload result
export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload buffer to Cloudinary with exact folder path
 * @param buffer - File buffer
 * @param folder - Folder path (e.g. 'ecommerce/products', 'ecommerce/categories', etc.)
 */
export const uploadToCloudinary = (
  buffer: Buffer,
  folder: CloudinaryFolderPath | string = CLOUDINARY_FOLDERS.PRODUCTS
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET
    ) {
      return reject(
        new Error('Cloudinary credentials are not configured')
      );
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,           // Tạo đúng cây thư mục hiển thị: ecommerce/products, ecommerce/categories...
        use_filename: true,
        unique_filename: true,
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            error || new Error('Upload to Cloudinary failed')
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};
