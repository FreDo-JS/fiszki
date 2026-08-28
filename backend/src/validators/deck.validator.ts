import { z } from 'zod';

const nameSchema = z.string().trim().min(1, 'Nazwa jest wymagana').max(120);
const descriptionSchema = z.string().trim().max(500).optional();

export const createDeckSchema = z.object({
  body: z.object({
    name: nameSchema,
    description: descriptionSchema,
    color: z.string().trim().max(20).optional(),
    icon: z.string().trim().max(10).optional(),
    // isPublic is only ever honored for admins (enforced in the controller),
    // never trusted blindly from the request body.
    isPublic: z.boolean().optional(),
  }),
});

export const updateDeckSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: nameSchema.optional(),
    description: descriptionSchema,
    color: z.string().trim().max(20).optional(),
    icon: z.string().trim().max(10).optional(),
    isPublic: z.boolean().optional(),
  }),
});

export const deckIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listDecksQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(200).optional(),
    tag: z.string().trim().max(40).optional(),
  }),
});
