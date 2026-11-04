import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().min(1, 'Email cannot be empty').email('Invalid email format'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(20, 'Password cannot exceed 20 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,20}$/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  avatar: z.string().url('Avatar must be a valid URL').optional(),
});

export const loginBodySchema = z.object({
  email: z.string().min(1, 'Email cannot be empty').email('Invalid email format'),
  password: z.string().min(1, 'Password cannot be empty'),
});

export const registerSchema = z.object({
  body: registerBodySchema,
});

export const loginSchema = z.object({
  body: loginBodySchema,
});

export type RegisterDto = z.infer<typeof registerBodySchema>;
export type LoginDto = z.infer<typeof loginBodySchema>;
