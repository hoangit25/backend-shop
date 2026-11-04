import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  MONGO_URL: z.string().min(1, 'MONGO_URL is required'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(() => process.env.CLOUD_NAME || ''),
  CLOUDINARY_API_KEY: z.string().optional().default(() => process.env.API_KEY || ''),
  CLOUDINARY_API_SECRET: z.string().optional().default(() => process.env.API_SECRET || ''),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_RESET_PASSWORD_SECRET: z.string().optional(),
  USER_EMAIL: z.string().optional(),
  USER_PASSWORD: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(_env.error.format(), null, 2)
  );
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
