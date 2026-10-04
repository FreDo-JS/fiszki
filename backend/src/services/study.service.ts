import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { CardLevel, CardType, Prisma } from '@prisma/client';
import { computeNextState, isPassingRating, qualityFor, Rating } from './sm2.service';
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

// `review` drills only cards the scheduler has already seen and brought back
// up, `new` only cards never studied before, and `mixed` (the default) keeps
// the original behaviour: overdue first, then due today, then new.
export type StudyMode = 'mixed' | 'review' | 'new';

export interface DueQueueFilters {
  limit: number;
  mode?: StudyMode;
  type?: CardType;
  level?: CardLevel;
}

export async function getDueQueue(user: DeckAuthContext, deckId: string, filters: DueQueueFilters) {
  await getOwnedDeckOrThrow(user, deckId);

  const { limit, mode = 'mixed' } = filters;
  const now = new Date();
  const today = startOfDay(now);

  const taxonomy: Prisma.CardWhereInput = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.level ? { level: filters.level } : {}),
  };

  const dueWindow: Prisma.CardWhereInput =
    mode === 'new'
      ? { lastReviewedAt: null }
      : mode === 'review'
        ? { lastReviewedAt: { not: null }, dueDate: { lte: now } }
        : { OR: [{ lastReviewedAt: null }, { dueDate: { lte: now } }] };

  const baseWhere: Prisma.CardWhereInput = { deckId, ...taxonomy, ...dueWindow };

  const newAllowance = await remainingNewAllowance(user.id, today);

  const candidates = await prisma.card.findMany({
    where: baseWhere,
    include: { tags: { include: { tag: true } } },
    orderBy: { dueDate: 'asc' },
    take: limit * 4,
  });

  const tierOf = (card: (typeof candidates)[number]): number => {
    if (card.lastReviewedAt === null) return 3; // new
    if (card.dueDate < today) return 1; // overdue
    return 2; // due today
  };

  // Repetitions always come first and are never capped — they are work the
  // learner already signed up for. Only the intake of brand new cards is
  // rationed, so an eager session today cannot bury next week.
  let newBudget = newAllowance;
  let queue = candidates
    .map((c) => ({ card: c, tier: tierOf(c) }))
    .sort((a, b) => a.tier - b.tier || a.card.dueDate.getTime() - b.card.dueDate.getTime())
    .filter(({ card }) => {
      if (card.lastReviewedAt !== null) return true;
      if (newBudget <= 0) return false;
      newBudget -= 1;
      return true;
    })
    .slice(0, limit)
    .map((x) => x.card);

  // Only the default mode studies ahead by padding with cards that aren't due
  // yet. In the explicit review/new modes an empty queue is a meaningful
  // answer ("nothing to repeat today"), so padding would be misleading.
  if (mode === 'mixed' && queue.length < limit) {
    const remaining = limit - queue.length;
    const excludeIds = queue.map((c) => c.id);
    const rest = await prisma.card.findMany({
      where: { deckId, ...taxonomy, id: { notIn: excludeIds.length ? excludeIds : undefined }, dueDate: { gt: now } },
      include: { tags: { include: { tag: true } } },
      orderBy: { dueDate: 'asc' },
      take: remaining,
    });
    queue = [...queue, ...rest];
  }

  const total = await prisma.card.count({ where: baseWhere });

  return {
    total,
    newAllowance,
    cards: queue.map((c) => ({ ...c, tags: c.tags.map((t) => t.tag.name) })),
  };
}

/**
 * How many never-seen cards the user may still start today: their daily limit
 * minus the ones already introduced, counted across every deck so the cap
 * cannot be sidestepped by hopping between them.
 */
async function remainingNewAllowance(userId: string, today: Date): Promise<number> {
  const [settings, progress] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dailyNewLimit: true } }),
    prisma.userProgress.findUnique({ where: { userId_date: { userId, date: today } } }),
  ]);

  const limit = settings?.dailyNewLimit ?? 20;
  return Math.max(0, limit - (progress?.newCardsLearned ?? 0));
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

  // "Correct" follows SM-2: only a quality of 3 or more counts as recall,
  // so both AGAIN (0) and HARD (1) are failures for stats and streaks.
  const correct = isPassingRating(input.rating);

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
        quality: qualityFor(input.rating),
        prevInterval: card.intervalDays,
        newInterval: nextState.intervalDays,
        prevEaseFactor: card.easeFactor,
        newEaseFactor: nextState.easeFactor,
        prevRepetitions: card.repetitions,
        newRepetitions: nextState.repetitions,
        // Everything undoReview needs to put the card back exactly as it was.
        prevDueDate: card.dueDate,
        prevLapses: card.lapses,
        prevMastered: card.mastered,
        prevLastReviewedAt: card.lastReviewedAt,
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

/**
 * Reverses the user's most recent grading: the card's SRS state is restored
 * from the snapshot taken when the review was written, and every aggregate
 * the review touched (daily progress, session counters, streak) is rolled
 * back with it. Only the single latest review can be undone, so history stays
 * consistent and a mis-tap is the only thing this can repair.
 */
export async function undoLastReview(user: DeckAuthContext) {
  const last = await prisma.review.findFirst({
    where: { userId: user.id },
    orderBy: { reviewedAt: 'desc' },
    include: { card: { include: { deck: true } } },
  });

  if (!last) throw ApiError.notFound('Nie ma czego cofnąć');
  if (!isOwner(user, last.card.deck)) throw ApiError.forbidden('Nie masz dostępu do tej fiszki');
  if (last.prevDueDate === null || last.prevLapses === null || last.prevMastered === null) {
    // Recorded before the snapshot columns existed; guessing the old due date
    // would silently corrupt the schedule, so refuse instead.
    throw ApiError.badRequest('Tej oceny nie da się cofnąć — pochodzi sprzed wprowadzenia tej funkcji');
  }

  const wasCorrect = isPassingRating(last.rating as Rating);
  const wasNewCard = last.prevLastReviewedAt === null;
  const day = startOfDay(last.reviewedAt);

  const card = await prisma.$transaction(async (tx) => {
    const restored = await tx.card.update({
      where: { id: last.cardId },
      data: {
        repetitions: last.prevRepetitions,
        intervalDays: last.prevInterval,
        easeFactor: last.prevEaseFactor,
        lapses: last.prevLapses!,
        mastered: last.prevMastered!,
        dueDate: last.prevDueDate!,
        lastReviewedAt: last.prevLastReviewedAt,
      },
    });

    if (last.sessionId) {
      await tx.studySession.updateMany({
        where: { id: last.sessionId, userId: user.id },
        data: {
          cardsStudied: { decrement: 1 },
          correctCount: wasCorrect ? { decrement: 1 } : undefined,
          incorrectCount: !wasCorrect ? { decrement: 1 } : undefined,
        },
      });
    }

    await tx.userProgress.updateMany({
      where: { userId: user.id, date: day },
      data: {
        cardsReviewed: { decrement: 1 },
        correctCount: wasCorrect ? { decrement: 1 } : undefined,
        incorrectCount: !wasCorrect ? { decrement: 1 } : undefined,
        studyTimeMs: { decrement: last.responseTimeMs ?? 0 },
        newCardsLearned: wasNewCard ? { decrement: 1 } : undefined,
      },
    });

    await tx.review.delete({ where: { id: last.id } });
    await recomputeStreak(tx, user.id);

    return restored;
  });

  return { card, undoneRating: last.rating };
}

/**
 * Rebuilds the streak from the daily progress rows. Undoing the only review
 * of a day has to be able to take the streak back down, and recomputing is
 * the one way to get that right without a second ledger.
 */
async function recomputeStreak(tx: Prisma.TransactionClient, userId: string) {
  const days = await tx.userProgress.findMany({
    where: { userId, cardsReviewed: { gt: 0 } },
    orderBy: { date: 'desc' },
    select: { date: true },
    take: 400,
  });

  if (days.length === 0) {
    await tx.user.update({ where: { id: userId }, data: { currentStreak: 0, lastStudyDate: null } });
    return;
  }

  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const latest = startOfDay(days[0].date);
  // A streak only counts as running if the last study day is today or
  // yesterday; anything older means it has already been broken.
  let streak = 0;
  if (latest.getTime() === today.getTime() || latest.getTime() === yesterday.getTime()) {
    streak = 1;
    let expected = new Date(latest);
    for (let i = 1; i < days.length; i++) {
      expected.setDate(expected.getDate() - 1);
      if (startOfDay(days[i].date).getTime() !== expected.getTime()) break;
      streak += 1;
    }
  }

  await tx.user.update({
    where: { id: userId },
    data: { currentStreak: streak, lastStudyDate: latest },
  });
}
