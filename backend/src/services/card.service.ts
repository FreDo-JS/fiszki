import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { stripHtml } from '../utils/sanitize';
import { canRead, canWrite, getDeckOrThrow, DeckAuthContext } from './deck.service';
import { initialSrsState } from './sm2.service';

const cardWithTags = Prisma.validator<Prisma.CardInclude>()({
  tags: { include: { tag: true } },
});

function serializeCard(card: Prisma.CardGetPayload<{ include: typeof cardWithTags }>) {
  return {
    ...card,
    tags: card.tags.map((ct) => ct.tag.name),
  };
}

async function resolveTagIds(tagNames: string[]): Promise<string[]> {
  const unique = [...new Set(tagNames.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  const ids: string[] = [];
  for (const name of unique) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    ids.push(tag.id);
  }
  return ids;
}

export async function getCardOrThrow(id: string) {
  const card = await prisma.card.findUnique({ where: { id }, include: { deck: true } });
  if (!card) throw ApiError.notFound('Fiszka nie istnieje');
  return card;
}

export async function getCard(user: DeckAuthContext, id: string) {
  const card = await prisma.card.findUnique({ where: { id }, include: { deck: true, ...cardWithTags } });
  if (!card) throw ApiError.notFound('Fiszka nie istnieje');
  if (!canRead(user, card.deck)) throw ApiError.forbidden('Nie masz dostępu do tej fiszki');
  return serializeCard(card as any);
}

export async function listCards(
  user: DeckAuthContext,
  filters: { deckId?: string; search?: string; tag?: string; page: number; pageSize: number }
) {
  if (filters.deckId) {
    const deck = await getDeckOrThrow(filters.deckId);
    if (!canRead(user, deck)) throw ApiError.forbidden('Nie masz dostępu do tego zestawu');
  }

  const where: Prisma.CardWhereInput = {
    deck: filters.deckId ? { id: filters.deckId } : { OR: [{ ownerId: user.id }, { isPublic: true }] },
    ...(filters.search
      ? {
          OR: [
            { word: { contains: filters.search, mode: 'insensitive' } },
            { translationPl: { contains: filters.search, mode: 'insensitive' } },
            { meaningEn: { contains: filters.search, mode: 'insensitive' } },
            { exampleSentence: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filters.tag ? { tags: { some: { tag: { name: filters.tag } } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.card.findMany({
      where,
      include: cardWithTags,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.card.count({ where }),
  ]);

  return {
    items: items.map(serializeCard),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export interface CardInput {
  word: string;
  meaningEn?: string;
  translationPl?: string;
  exampleSentence?: string;
  pronunciationIpa?: string;
  partOfSpeech?: string;
  tags?: string[];
}

export async function createCard(user: DeckAuthContext, deckId: string, input: CardInput) {
  const deck = await getDeckOrThrow(deckId);
  if (!canWrite(user, deck)) throw ApiError.forbidden('Nie masz uprawnień do dodawania fiszek w tym zestawie');

  const tagIds = await resolveTagIds(input.tags ?? []);
  const srs = initialSrsState();

  const card = await prisma.card.create({
    data: {
      deckId,
      word: stripHtml(input.word)!,
      meaningEn: stripHtml(input.meaningEn) ?? null,
      translationPl: stripHtml(input.translationPl) ?? null,
      exampleSentence: stripHtml(input.exampleSentence) ?? null,
      pronunciationIpa: stripHtml(input.pronunciationIpa) ?? null,
      partOfSpeech: stripHtml(input.partOfSpeech) ?? null,
      repetitions: srs.repetitions,
      intervalDays: srs.intervalDays,
      easeFactor: srs.easeFactor,
      lapses: srs.lapses,
      mastered: srs.mastered,
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
    include: cardWithTags,
  });

  return serializeCard(card);
}

export async function updateCard(user: DeckAuthContext, id: string, input: Partial<CardInput>) {
  const card = await getCardOrThrow(id);
  if (!canWrite(user, card.deck)) throw ApiError.forbidden('Nie masz uprawnień do edycji tej fiszki');

  if (input.tags !== undefined) {
    const tagIds = await resolveTagIds(input.tags);
    await prisma.cardTag.deleteMany({ where: { cardId: id } });
    if (tagIds.length > 0) {
      await prisma.cardTag.createMany({ data: tagIds.map((tagId) => ({ cardId: id, tagId })) });
    }
  }

  const updated = await prisma.card.update({
    where: { id },
    data: {
      ...(input.word !== undefined ? { word: stripHtml(input.word) } : {}),
      ...(input.meaningEn !== undefined ? { meaningEn: stripHtml(input.meaningEn) ?? null } : {}),
      ...(input.translationPl !== undefined ? { translationPl: stripHtml(input.translationPl) ?? null } : {}),
      ...(input.exampleSentence !== undefined ? { exampleSentence: stripHtml(input.exampleSentence) ?? null } : {}),
      ...(input.pronunciationIpa !== undefined ? { pronunciationIpa: stripHtml(input.pronunciationIpa) ?? null } : {}),
      ...(input.partOfSpeech !== undefined ? { partOfSpeech: stripHtml(input.partOfSpeech) ?? null } : {}),
    },
    include: cardWithTags,
  });

  return serializeCard(updated);
}

export async function deleteCard(user: DeckAuthContext, id: string) {
  const card = await getCardOrThrow(id);
  if (!canWrite(user, card.deck)) throw ApiError.forbidden('Nie masz uprawnień do usunięcia tej fiszki');
  await prisma.card.delete({ where: { id } });
}

export async function listAllTags() {
  return prisma.tag.findMany({ orderBy: { name: 'asc' } });
}
