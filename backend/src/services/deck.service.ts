import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { stripHtml } from '../utils/sanitize';
import { Deck } from '@prisma/client';

export interface DeckAuthContext {
  id: string;
  role: 'USER' | 'ADMIN';
}

export function canRead(user: DeckAuthContext, deck: Deck): boolean {
  return deck.ownerId === user.id || deck.isPublic;
}

export function canWrite(user: DeckAuthContext, deck: Deck): boolean {
  return deck.ownerId === user.id || (user.role === 'ADMIN' && deck.isPublic);
}

export async function getDeckOrThrow(id: string): Promise<Deck> {
  const deck = await prisma.deck.findUnique({ where: { id } });
  if (!deck) throw ApiError.notFound('Zestaw nie istnieje');
  return deck;
}

export async function listDecks(user: DeckAuthContext, filters: { search?: string; tag?: string }) {
  const decks = await prisma.deck.findMany({
    where: {
      OR: [{ ownerId: user.id }, { isPublic: true }],
      ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
      ...(filters.tag
        ? { cards: { some: { tags: { some: { tag: { name: filters.tag } } } } } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (decks.length === 0) return [];

  const deckIds = decks.map((d) => d.id);
  const now = new Date();

  const [totalCounts, dueCounts, masteredCounts, lastSessions] = await Promise.all([
    prisma.card.groupBy({ by: ['deckId'], where: { deckId: { in: deckIds } }, _count: { _all: true } }),
    prisma.card.groupBy({
      by: ['deckId'],
      where: { deckId: { in: deckIds }, dueDate: { lte: now } },
      _count: { _all: true },
    }),
    prisma.card.groupBy({
      by: ['deckId'],
      where: { deckId: { in: deckIds }, mastered: true },
      _count: { _all: true },
    }),
    prisma.studySession.groupBy({
      by: ['deckId'],
      where: { userId: user.id, deckId: { in: deckIds } },
      _max: { startedAt: true },
    }),
  ]);

  const totalMap = new Map(totalCounts.map((c) => [c.deckId, c._count._all]));
  const dueMap = new Map(dueCounts.map((c) => [c.deckId, c._count._all]));
  const masteredMap = new Map(masteredCounts.map((c) => [c.deckId, c._count._all]));
  const lastStudiedMap = new Map(lastSessions.map((s) => [s.deckId as string, s._max.startedAt]));

  return decks.map((deck) => {
    const cardCount = totalMap.get(deck.id) ?? 0;
    const masteredCount = masteredMap.get(deck.id) ?? 0;
    return {
      ...deck,
      owned: deck.ownerId === user.id,
      cardCount,
      dueCount: dueMap.get(deck.id) ?? 0,
      masteredCount,
      masteryPercent: cardCount > 0 ? Math.round((masteredCount / cardCount) * 100) : 0,
      lastStudiedAt: lastStudiedMap.get(deck.id) ?? null,
    };
  });
}

export async function getDeckDetail(user: DeckAuthContext, id: string) {
  const deck = await getDeckOrThrow(id);
  if (!canRead(user, deck)) throw ApiError.forbidden('Nie masz dostępu do tego zestawu');

  const now = new Date();
  const [cardCount, dueCount, masteredCount] = await Promise.all([
    prisma.card.count({ where: { deckId: id } }),
    prisma.card.count({ where: { deckId: id, dueDate: { lte: now } } }),
    prisma.card.count({ where: { deckId: id, mastered: true } }),
  ]);

  return {
    ...deck,
    owned: deck.ownerId === user.id,
    cardCount,
    dueCount,
    masteredCount,
    masteryPercent: cardCount > 0 ? Math.round((masteredCount / cardCount) * 100) : 0,
  };
}

export async function createDeck(
  user: DeckAuthContext,
  input: { name: string; description?: string; color?: string; icon?: string; isPublic?: boolean }
) {
  return prisma.deck.create({
    data: {
      name: stripHtml(input.name)!,
      description: stripHtml(input.description) ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      // Only admins may publish a public deck — a regular user's request
      // body is never trusted for this flag.
      isPublic: user.role === 'ADMIN' ? Boolean(input.isPublic) : false,
      ownerId: user.id,
    },
  });
}

export async function updateDeck(
  user: DeckAuthContext,
  id: string,
  input: { name?: string; description?: string; color?: string; icon?: string; isPublic?: boolean }
) {
  const deck = await getDeckOrThrow(id);
  if (!canWrite(user, deck)) throw ApiError.forbidden('Nie masz uprawnień do edycji tego zestawu');

  return prisma.deck.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: stripHtml(input.name) } : {}),
      ...(input.description !== undefined ? { description: stripHtml(input.description) ?? null } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(user.role === 'ADMIN' && input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
    },
  });
}

export async function deleteDeck(user: DeckAuthContext, id: string) {
  const deck = await getDeckOrThrow(id);
  if (!canWrite(user, deck)) throw ApiError.forbidden('Nie masz uprawnień do usunięcia tego zestawu');
  await prisma.deck.delete({ where: { id } });
}

export async function duplicateDeck(user: DeckAuthContext, id: string) {
  const deck = await getDeckOrThrow(id);
  if (!canRead(user, deck)) throw ApiError.forbidden('Nie masz dostępu do tego zestawu');

  const cards = await prisma.card.findMany({ where: { deckId: id }, include: { tags: { include: { tag: true } } } });

  return prisma.$transaction(async (tx) => {
    const newDeck = await tx.deck.create({
      data: {
        name: `${deck.name} (kopia)`,
        description: deck.description,
        color: deck.color,
        icon: deck.icon,
        isPublic: false,
        ownerId: user.id,
      },
    });

    for (const card of cards) {
      await tx.card.create({
        data: {
          deckId: newDeck.id,
          word: card.word,
          meaningEn: card.meaningEn,
          translationPl: card.translationPl,
          exampleSentence: card.exampleSentence,
          pronunciationIpa: card.pronunciationIpa,
          partOfSpeech: card.partOfSpeech,
          tags: {
            create: card.tags.map((ct) => ({ tagId: ct.tagId })),
          },
        },
      });
    }

    return newDeck;
  });
}
