import { z } from 'zod';

export const dueQueueSchema = z.object({
  params: z.object({ deckId: z.string().uuid() }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const startSessionSchema = z.object({
  body: z.object({
    deckId: z.string().uuid(),
  }),
});

export const endSessionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const submitReviewSchema = z.object({
  body: z.object({
    cardId: z.string().uuid(),
    rating: z.enum(['AGAIN', 'HARD', 'GOOD']),
    responseTimeMs: z.number().int().min(0).max(10 * 60 * 1000).optional(),
    sessionId: z.string().uuid().optional(),
  }),
});
