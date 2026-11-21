import { z } from 'zod';

export const getBannersQuerySchema = z.object({
  query: z
    .object({
      placement: z.string().optional(),
      isActive: z.enum(['true', 'false']).optional(),
    })
    .optional(),
});

export const createBannerBodySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  subtitle: z.string().max(200).optional().default(''),
  image: z.string().min(1, 'Image is required'),
  alt: z.string().max(200).optional().default(''),
  date: z.string().max(100).optional().default(''),
  discount: z.string().max(50).optional().default(''),
  voucher: z.string().max(50).optional().default(''),
  link: z.string().max(500).optional().default(''),
  placement: z.string().max(50).optional().default('home_hero'),
  position: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateBannerBodySchema = createBannerBodySchema.partial();

export const createBannerSchema = z.object({
  body: createBannerBodySchema,
});

export const updateBannerSchema = z.object({
  body: updateBannerBodySchema,
  params: z.object({
    id: z.string().min(1, 'Banner ID is required'),
  }),
});

export const getBannerByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Banner ID is required'),
  }),
});
