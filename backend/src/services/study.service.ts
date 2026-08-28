import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { computeNextState, Rating } from './sm2.service';
import { DeckAuthContext, getDeckOrThrow } from './deck.service';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOwner(user: DeckAuthContext, deck: { ownerId: string }) {
  return deck.ownerId === user.id;
}

// Studying (and therefore persisted SRS progress) is only available for
// decks the user owns. Public decks carry a single shared Card row, so
// letting arbitrary users grade it would mean every learner overwrites the
// same due date / ease factor — instead, users duplicate a public deck into
// their own collection first (see deck.service#duplicateDeck), which gives
// each of them an independent copy to actually study.
async function getOwnedDeckOrThrow(user: DeckAuthContext, deckId: string) {
  const deck = await getDeckOrThrow(deckId);
  if (!isOwner(user, deck)) {
    throw ApiError.forbidden('Naukę można rozpocząć tylko dla własnych zestawów. Zduplikuj ten zestaw, aby zacząć się uczyć.');
  }
  return deck;
}

export async function getDueQueue(user: DeckAuthContext, deckId: string, limit: number) {
  await getOwnedDeckOrThrow(user, deckId);

  const now = new Date();
  const today = startOfDay(now);

  const candidates = await prisma.card.findMany({
    where: {
      deckId,
      OR: [{ lastReviewedAt: null }, { dueDate: { lte: now } }],
    },
    include: { tags: { include: { tag: true } } },
    orderBy: { dueDate: 'asc' },
    take: limit * 4,
  });

  const tierOf = (card: (typeof candidates)[number]): number => {
    if (card.lastReviewedAt === null) return 3; // new
    if (card.dueDate < today) return 1; // overdue
    return 2; // due today
  };

  let queue = candidates
    .map((c) => ({ card: c, tier: tierOf(c) }))
    .sort((a, b) => a.tier - b.tier || a.card.dueDate.getTime() - b.card.dueDate.getTime())
    .slice(0, limit)
    .map((x) => x.card);

  if (queue.length < limit) {
    const remaining = limit - queue.length;
    const excludeIds = queue.map((c) => c.id);
    const rest = await prisma.card.findMany({
      where: { deckId, id: { notIn: excludeIds.length ? excludeIds : undefined }, dueDate: { gt: now } },
      include: { tags: { include: { tag: true } } },
      orderBy: { dueDate: 'asc' },
      take: remaining,
    });
    queue = [...queue, ...rest];
  }

  const total = await prisma.card.count({
    where: { deckId, OR: [{ lastReviewedAt: null }, { dueDate: { lte: now } }] },
  });

  return {
    total,
    cards: queue.map((c) => ({ ...c, tags: c.tags.map((t) => t.tag.name) })),
  };
}

export async function startSession(user: DeckAuthContext, deckId: string) {
  await getOwnedDeckOrThrow(user, deckId);
  return prisma.studySession.create({ data: { userId: user.id, deckId } });
}

export async function endSession(user: DeckAuthContext, sessionId: string) {
  const session = await prisma.studySession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) throw ApiError.notFound('Sesja nauki nie istnieje');
  return prisma.studySession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
}

export interface SubmitReviewInput {
  cardId: string;
  rating: Rating;
  responseTimeMs?: number;
  sessionId?: string;
}

export async function submitReview(user: DeckAuthContext, input: SubmitReviewInput) {
  const card = await prisma.card.findUnique({ where: { id: input.cardId }, include: { deck: true } });
  if (!card) throw ApiError.notFound('Fiszka nie istnieje');
  if (!isOwner(user, card.deck)) throw ApiError.forbidden('Nie masz dostępu do tej fiszki');

  const now = new Date();
  const today = startOfDay(now);
  const isNewCard = card.lastReviewedAt === null;

  const nextState = computeNextState(
    {
      repetitions: card.repetitions,
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      lapses: card.lapses,
      mastered: card.mastered,
    },
    input.rating,
    now
  );

  const correct = input.rating !== 'AGAIN';

  const [updatedCard, review] = await prisma.$transaction(async (tx) => {
    const updatedCard = await tx.card.update({
      where: { id: card.id },
      data: {
        repetitions: nextState.repetitions,
        intervalDays: nextState.intervalDays,
        easeFactor: nextState.easeFactor,
        lapses: nextState.lapses,
        mastered: nextState.mastered,
        dueDate: nextState.dueDate,
        lastReviewedAt: now,
      },
    });

    const review = await tx.review.create({
      data: {
        userId: user.id,
        cardId: card.id,
        rating: input.rating,
        prevInterval: card.intervalDays,
        newInterval: nextState.intervalDays,
        prevEaseFactor: card.easeFactor,
        newEaseFactor: nextState.easeFactor,
        prevRepetitions: card.repetitions,
        newRepetitions: nextState.repetitions,
        responseTimeMs: input.responseTimeMs,
        sessionId: input.sessionId,
      },
    });

    if (input.sessionId) {
      await tx.studySession.updateMany({
        where: { id: input.sessionId, userId: user.id },
        data: {
          cardsStudied: { increment: 1 },
          correctCount: correct ? { increment: 1 } : undefined,
          incorrectCount: !correct ? { increment: 1 } : undefined,
        },
      });
    }

    await tx.userProgress.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      create: {
        userId: user.id,
        date: today,
        cardsReviewed: 1,
        correctCount: correct ? 1 : 0,
        incorrectCount: correct ? 0 : 1,
        studyTimeMs: input.responseTimeMs ?? 0,
        newCardsLearned: isNewCard ? 1 : 0,
      },
      update: {
        cardsReviewed: { increment: 1 },
        correctCount: correct ? { increment: 1 } : undefined,
        incorrectCount: !correct ? { increment: 1 } : undefined,
        studyTimeMs: { increment: input.responseTimeMs ?? 0 },
        newCardsLearned: isNewCard ? { increment: 1 } : undefined,
      },
    });

    // Streak: only advances the first time a real review lands on a new
    // calendar day, so simply opening the app can never bump it.
    const dbUser = await tx.user.findUnique({ where: { id: user.id }, select: { lastStudyDate: true, currentStreak: true, bestStreak: true } });
    if (dbUser) {
      const lastDate = dbUser.lastStudyDate ? startOfDay(dbUser.lastStudyDate) : null;
      if (!lastDate || lastDate.getTime() !== today.getTime()) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const isConsecutive = lastDate !== null && lastDate.getTime() === yesterday.getTime();
        const newStreak = isConsecutive ? dbUser.currentStreak + 1 : 1;
        await tx.user.update({
          where: { id: user.id },
          data: {
            currentStreak: newStreak,
            bestStreak: Math.max(newStreak, dbUser.bestStreak),
            lastStudyDate: today,
          },
        });
      }
    }

    return [updatedCard, review];
  });

  return { card: updatedCard, review };
}
