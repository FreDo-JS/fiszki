import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const setStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ status: z.enum(['ACTIVE', 'BLOCKED']) }),
});

export const setRoleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ role: z.enum(['USER', 'ADMIN']) }),
});
