export const CLOUDINARY_FOLDERS = {
  PRODUCTS: 'samples/ecommerce/products',
  CATEGORIES: 'samples/ecommerce/categories',
  AVATARS: 'samples/ecommerce/avatars',
  BANNERS: 'samples/ecommerce/banners',
} as const;

export type CloudinaryFolderType = keyof typeof CLOUDINARY_FOLDERS;
export type CloudinaryFolderPath = (typeof CLOUDINARY_FOLDERS)[keyof typeof CLOUDINARY_FOLDERS];

