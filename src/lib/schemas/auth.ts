import { z } from 'zod'

export const signUpSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  fullName: z.string().min(1, 'Tell us what to call you').max(80),
})
export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Enter your password').max(200),
})
export type SignInInput = z.infer<typeof signInSchema>

export const emailSchema = z.object({ email: z.string().email() })

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
})

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Please check your details and try again.'
}
