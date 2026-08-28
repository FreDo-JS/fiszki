import { z } from 'zod';

export const importSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    format: z.enum(['csv', 'json']),
    content: z.string().min(1).max(2_000_000),
  }),
});

export const exportSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    format: z.enum(['csv', 'json']).default('json'),
  }),
});
