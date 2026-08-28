import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Nazwa użytkownika musi mieć co najmniej 3 znaki')
  .max(32, 'Nazwa użytkownika może mieć maksymalnie 32 znaki')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Nazwa użytkownika może zawierać tylko litery, cyfry, "_", "-" i "."');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Nieprawidłowy adres e-mail')
  .max(255);

// Requires upper + lower + digit and a sane max length (defends against
// bcrypt/argon2 DoS via absurdly long inputs).
const passwordSchema = z
  .string()
  .min(8, 'Hasło musi mieć co najmniej 8 znaków')
  .max(128, 'Hasło może mieć maksymalnie 128 znaków')
  .regex(/[a-z]/, 'Hasło musi zawierać małą literę')
  .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
  .regex(/[0-9]/, 'Hasło musi zawierać cyfrę');

export const registerSchema = z.object({
  body: z
    .object({
      username: usernameSchema,
      email: emailSchema,
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Hasła muszą być identyczne',
      path: ['confirmPassword'],
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Hasło jest wymagane').max(128),
  }),
});
