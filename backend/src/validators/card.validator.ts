import { z } from 'zod';

const wordSchema = z.string().trim().min(1, 'Słówko jest wymagane').max(120);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createCardSchema = z.object({
  body: z.object({
    deckId: z.string().uuid(),
    word: wordSchema,
    meaningEn: optionalText(1000),
    translationPl: optionalText(500),
    exampleSentence: optionalText(1000),
    pronunciationIpa: optionalText(200),
    partOfSpeech: optionalText(40),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  }),
});

export const updateCardSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    word: wordSchema.optional(),
    meaningEn: optionalText(1000),
    translationPl: optionalText(500),
    exampleSentence: optionalText(1000),
    pronunciationIpa: optionalText(200),
    partOfSpeech: optionalText(40),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  }),
});

export const cardIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listCardsQuerySchema = z.object({
  query: z.object({
    deckId: z.string().uuid().optional(),
    search: z.string().trim().max(200).optional(),
    tag: z.string().trim().max(40).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const generateFieldsSchema = z.object({
  body: z.object({
    word: wordSchema,
  }),
});
