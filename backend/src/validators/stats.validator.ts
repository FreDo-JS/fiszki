import { z } from 'zod';

export const chartsQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(400).default(30),
  }),
});
