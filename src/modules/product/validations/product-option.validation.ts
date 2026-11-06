import { z } from 'zod';
import { PRODUCT_CONSTANTS, OPTION_DISPLAY_TYPES } from '../constants/product.constant';

// ── Option Value Schema ──
export const optionValueSchema = z.object({
  name: z.string().min(1, 'Value name is required').trim(),
  code: z.string().optional().default(''),
  image: z.string().url('Image must be a valid URL').optional().or(z.literal('')),
  priceAdjustment: z.number().optional().default(0),
  isDefault: z.boolean().optional().default(false),
});

// ── Create Product Option ──
export const createProductOptionBodySchema = z.object({
  name: z.string().min(1, 'Option name is required').max(100),
  type: z.enum(OPTION_DISPLAY_TYPES).optional().default('TEXT'),
  isRequired: z.boolean().optional().default(true),
  description: z.string().max(500).optional().default(''),
  values: z
    .array(optionValueSchema)
    .min(1, 'At least one option value is required')
    .max(PRODUCT_CONSTANTS.MAX_OPTION_VALUES),
  position: z.number().int().min(0).optional().default(0),
});

export const createProductOptionSchema = z.object({
  body: createProductOptionBodySchema,
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
  }),
});

// ── Update Product Option ──
export const updateProductOptionBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(OPTION_DISPLAY_TYPES).optional(),
  isRequired: z.boolean().optional(),
  description: z.string().max(500).optional(),
  values: z
    .array(optionValueSchema)
    .min(1)
    .max(PRODUCT_CONSTANTS.MAX_OPTION_VALUES)
    .optional(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateProductOptionSchema = z.object({
  body: updateProductOptionBodySchema,
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    optionId: z.string().min(1, 'Option ID is required'),
  }),
});

// ── Delete Product Option ──
export const deleteProductOptionSchema = z.object({
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    optionId: z.string().min(1, 'Option ID is required'),
  }),
});

export type CreateProductOptionDto = z.infer<typeof createProductOptionBodySchema>;
export type UpdateProductOptionDto = z.infer<typeof updateProductOptionBodySchema>;
export type OptionValueDto = z.infer<typeof optionValueSchema>;
