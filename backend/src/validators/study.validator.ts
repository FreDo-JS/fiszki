import { z } from 'zod';

export const cardTypeSchema = z.enum(['VOCABULARY', 'GRAMMAR', 'TENSES']);
export const cardLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1']);
export const ratingSchema = z.enum(['AGAIN', 'HARD', 'OK', 'GOOD', 'EASY']);

export const dueQueueSchema = z.object({
  params: z.object({ deckId: z.string().uuid() }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    mode: z.enum(['mixed', 'review', 'new']).default('mixed'),
    type: cardTypeSchema.optional(),
    level: cardLevelSchema.optional(),
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
    rating: ratingSchema,
    responseTimeMs: z.number().int().min(0).max(10 * 60 * 1000).optional(),
    sessionId: z.string().uuid().optional(),
  }),
});
