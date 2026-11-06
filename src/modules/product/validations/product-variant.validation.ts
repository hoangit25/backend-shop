import { z } from 'zod';
import { PRODUCT_CONSTANTS } from '../constants/product.constant';

// ── Create Product Variant ──
export const createProductVariantBodySchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(PRODUCT_CONSTANTS.SKU_MAX_LENGTH)
    .trim(),
  barcode: z.string().optional().default(''),
  size: z.string().optional().default(''),
  color: z.string().optional().default(''),
  colorCode: z.string().optional().default(''),
  optionValues: z.record(z.string(), z.string()).optional().default({}),
  price: z
    .number()
    .min(PRODUCT_CONSTANTS.MIN_PRICE, 'Price must be a positive number')
    .max(PRODUCT_CONSTANTS.MAX_PRICE),
  originalPrice: z.number().min(0).optional().default(0),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  image: z.string().url('Image must be a valid URL').optional().or(z.literal('')),
  weight: z.number().min(0).optional().default(0),
});

export const createProductVariantSchema = z.object({
  body: createProductVariantBodySchema,
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
  }),
});

// ── Update Product Variant ──
export const updateProductVariantBodySchema = z.object({
  sku: z.string().min(1).max(PRODUCT_CONSTANTS.SKU_MAX_LENGTH).trim().optional(),
  barcode: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  colorCode: z.string().optional(),
  optionValues: z.record(z.string(), z.string()).optional(),
  price: z
    .number()
    .min(PRODUCT_CONSTANTS.MIN_PRICE)
    .max(PRODUCT_CONSTANTS.MAX_PRICE)
    .optional(),
  originalPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  image: z.string().url('Image must be a valid URL').optional().or(z.literal('')),
  weight: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateProductVariantSchema = z.object({
  body: updateProductVariantBodySchema,
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    variantId: z.string().min(1, 'Variant ID is required'),
  }),
});

// ── Delete Product Variant ──
export const deleteProductVariantSchema = z.object({
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    variantId: z.string().min(1, 'Variant ID is required'),
  }),
});

// ── Find Variant by Size & Color / Options ──
export const findVariantSchema = z.object({
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
  }),
  body: z.object({
    size: z.string().optional(),
    color: z.string().optional(),
    optionValues: z.record(z.string(), z.string()).optional(),
  }),
});

export type CreateProductVariantDto = z.infer<typeof createProductVariantBodySchema>;
export type UpdateProductVariantDto = z.infer<typeof updateProductVariantBodySchema>;
