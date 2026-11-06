import { z } from 'zod';

export const createCategoryBodySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(1000).optional().default(''),
  image: z.string().url('Image must be a valid URL').optional().or(z.literal('')),
  parentId: z.string().optional().nullable(),
  position: z.number().int().min(0).optional().default(0),
});

export const updateCategoryBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  image: z.string().url('Image must be a valid URL').optional().or(z.literal('')),
  parentId: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  body: createCategoryBodySchema,
});

export const updateCategorySchema = z.object({
  body: updateCategoryBodySchema,
  params: z.object({
    id: z.string().min(1, 'Category ID is required'),
  }),
});

export const getCategoryByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Category ID is required'),
  }),
});

