import { z } from 'zod';
import { PRODUCT_CONSTANTS, PRODUCT_STATUSES } from '../constants/product.constant';

const attributeSchema = z.object({
  name: z.string().min(1, 'Attribute name is required').trim(),
  value: z.string().min(1, 'Attribute value is required').trim(),
});

const dimensionsSchema = z.object({
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
});

// ── Create Product ──
export const createProductBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(PRODUCT_CONSTANTS.MAX_NAME_LENGTH, `Name cannot exceed ${PRODUCT_CONSTANTS.MAX_NAME_LENGTH} characters`),
  description: z
    .string()
    .max(PRODUCT_CONSTANTS.MAX_DESCRIPTION_LENGTH)
    .optional()
    .default(''),
  brand: z.string().optional().default(''),
  image: z.string().url('Image must be a valid URL').optional().default(''),
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .max(PRODUCT_CONSTANTS.MAX_IMAGES)
    .optional()
    .default([]),
  categoryId: z.string().min(1, 'Category is required'),
  price: z
    .number()
    .min(PRODUCT_CONSTANTS.MIN_PRICE, 'Price must be a positive number')
    .max(PRODUCT_CONSTANTS.MAX_PRICE),
  originalPrice: z
    .number()
    .min(0)
    .optional()
    .default(0),
  discount: z
    .number()
    .min(PRODUCT_CONSTANTS.MIN_DISCOUNT)
    .max(PRODUCT_CONSTANTS.MAX_DISCOUNT)
    .optional()
    .default(0),
  stock: z.number().int().min(0).optional().default(PRODUCT_CONSTANTS.DEFAULT_STOCK),
  attributes: z.array(attributeSchema).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  weight: z.number().min(0).optional().default(0),
  dimensions: dimensionsSchema.optional().default({}),
  status: z.enum(PRODUCT_STATUSES).optional().default('ACTIVE'),
  isFeatured: z.boolean().optional().default(false),
});

export const createProductSchema = z.object({
  body: createProductBodySchema,
});

// ── Update Product ──
export const updateProductBodySchema = z.object({
  name: z.string().min(1).max(PRODUCT_CONSTANTS.MAX_NAME_LENGTH).optional(),
  description: z.string().max(PRODUCT_CONSTANTS.MAX_DESCRIPTION_LENGTH).optional(),
  brand: z.string().optional(),
  image: z.string().url('Image must be a valid URL').optional(),
  images: z.array(z.string().url()).max(PRODUCT_CONSTANTS.MAX_IMAGES).optional(),
  categoryId: z.string().min(1).optional(),
  price: z.number().min(PRODUCT_CONSTANTS.MIN_PRICE).max(PRODUCT_CONSTANTS.MAX_PRICE).optional(),
  originalPrice: z.number().min(0).optional(),
  discount: z.number().min(PRODUCT_CONSTANTS.MIN_DISCOUNT).max(PRODUCT_CONSTANTS.MAX_DISCOUNT).optional(),
  stock: z.number().int().min(0).optional(),
  attributes: z.array(attributeSchema).optional(),
  tags: z.array(z.string()).optional(),
  weight: z.number().min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = z.object({
  body: updateProductBodySchema,
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
});

// ── Get Product by ID ──
export const getProductByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
});

// ── Get Product by Slug ──
export const getProductBySlugSchema = z.object({
  params: z.object({
    slug: z.string().min(1, 'Product slug is required'),
  }),
});

// ── List Products Query ──
export const listProductsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    keyword: z.string().optional(),
    categoryId: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    rating: z.coerce.number().min(1).max(5).optional(),
    inStock: z
      .string()
      .optional()
      .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
    isFeatured: z
      .string()
      .optional()
      .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
    status: z.enum(PRODUCT_STATUSES).optional(),
  }),
});

export type CreateProductDto = z.infer<typeof createProductBodySchema>;
export type UpdateProductDto = z.infer<typeof updateProductBodySchema>;
