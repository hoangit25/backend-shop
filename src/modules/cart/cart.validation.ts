import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const addItemBodySchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema.optional().nullable(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity cannot exceed 999').default(1),
  selected: z.boolean().optional().default(true),
});

export const updateItemBodySchema = z
  .object({
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity cannot exceed 999').optional(),
    selected: z.boolean().optional(),
  })
  .refine(
    (data) => data.quantity !== undefined || data.selected !== undefined,
    'Either quantity or selected must be provided'
  );

export const updateItemQuantityBodySchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity cannot exceed 999'),
});

export const selectItemsBodySchema = z
  .object({
    itemIds: z.array(z.string().min(1)).optional(),
    selected: z.boolean().optional(),
    selectAll: z.boolean().optional(),
  })
  .refine(
    (data) => data.selectAll !== undefined || (data.itemIds && data.itemIds.length > 0),
    'Must provide itemIds or selectAll'
  );

export const applyCouponBodySchema = z.object({
  code: z
    .string()
    .min(1, 'Coupon code is required')
    .max(50, 'Coupon code cannot exceed 50 characters')
    .transform((val) => val.trim().toUpperCase()),
});

export const mergeCartItemSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999).default(1),
  selected: z.boolean().optional().default(true),
});

export const mergeCartBodySchema = z
  .object({
    guestId: z.string().trim().optional(),
    items: z.array(mergeCartItemSchema).optional(),
  })
  .refine(
    (data) => Boolean(data.guestId || (data.items && data.items.length > 0)),
    'Either guestId or items array is required for merging'
  );

// Route Schemas combining body/params/query for validate() middleware
export const addItemSchema = z.object({
  body: addItemBodySchema,
});

export const updateItemSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, 'Item ID is required'),
  }),
  body: updateItemBodySchema,
});

export const removeItemSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, 'Item ID is required'),
  }),
});

export const selectItemsSchema = z.object({
  body: selectItemsBodySchema,
});

export const applyCouponSchema = z.object({
  body: applyCouponBodySchema,
});

export const mergeCartSchema = z.object({
  body: mergeCartBodySchema,
});

