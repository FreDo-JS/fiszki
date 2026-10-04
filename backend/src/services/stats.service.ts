import { CardLevel, CardType } from '@prisma/client';
import { prisma } from '../config/prisma';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getOverview(userId: string) {
  const now = new Date();
  const today = startOfDay(now);

  const [
    totalCards,
    masteredCards,
    newCards,
    dueToday,
    todayProgress,
    reviewAgg,
    user,
  ] = await Promise.all([
    prisma.card.count({ where: { deck: { ownerId: userId } } }),
    prisma.card.count({ where: { deck: { ownerId: userId }, mastered: true } }),
    prisma.card.count({ where: { deck: { ownerId: userId }, lastReviewedAt: null } }),
    prisma.card.count({ where: { deck: { ownerId: userId }, dueDate: { lte: now } } }),
    prisma.userProgress.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, bestStreak: true, lastStudyDate: true },
    }),
  ]);

  const totalReviews = reviewAgg.reduce((sum, r) => sum + r._count._all, 0);
  // Mirrors sm2.service#isPassingRating: only quality >= 3 is a recall, so
  // AGAIN (0) and HARD (1) both count against accuracy.
  const incorrect = reviewAgg
    .filter((r) => r.rating === 'AGAIN' || r.rating === 'HARD')
    .reduce((sum, r) => sum + r._count._all, 0);
  const correct = totalReviews - incorrect;
  const accuracy = totalReviews > 0 ? Math.round((correct / totalReviews) * 100) : 0;

  const totalStudyTime = await prisma.userProgress.aggregate({
    where: { userId },
    _sum: { studyTimeMs: true },
  });

  return {
    totalCards,
    masteredCards,
    newCards,
    dueToday,
    reviewsToday: todayProgress?.cardsReviewed ?? 0,
    accuracy,
    correctCount: correct,
    incorrectCount: incorrect,
    totalReviews,
    currentStreak: user?.currentStreak ?? 0,
    bestStreak: user?.bestStreak ?? 0,
    lastStudyDate: user?.lastStudyDate ?? null,
    totalStudyTimeMs: totalStudyTime._sum.studyTimeMs ?? 0,
  };
}

export async function getDailySeries(userId: string, days: number) {
  const now = new Date();
  const today = startOfDay(now);
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));

  const rows = await prisma.userProgress.findMany({
    where: { userId, date: { gte: from, lte: today } },
    orderBy: { date: 'asc' },
  });

  const byDate = new Map(rows.map((r) => [toDateKey(r.date), r]));
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const key = toDateKey(d);
    const row = byDate.get(key);
    series.push({
      date: key,
      cardsReviewed: row?.cardsReviewed ?? 0,
      correctCount: row?.correctCount ?? 0,
      incorrectCount: row?.incorrectCount ?? 0,
      studyTimeMs: row?.studyTimeMs ?? 0,
      newCardsLearned: row?.newCardsLearned ?? 0,
    });
  }
  return series;
}

export async function getDeckProgress(userId: string) {
  const decks = await prisma.deck.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' } });
  const deckIds = decks.map((d) => d.id);
  if (deckIds.length === 0) return [];

  const [totals, mastered] = await Promise.all([
    prisma.card.groupBy({ by: ['deckId'], where: { deckId: { in: deckIds } }, _count: { _all: true } }),
    prisma.card.groupBy({ by: ['deckId'], where: { deckId: { in: deckIds }, mastered: true }, _count: { _all: true } }),
  ]);
  const totalMap = new Map(totals.map((t) => [t.deckId, t._count._all]));
  const masteredMap = new Map(mastered.map((t) => [t.deckId, t._count._all]));

  return decks.map((d) => {
    const total = totalMap.get(d.id) ?? 0;
    const masteredCount = masteredMap.get(d.id) ?? 0;
    return {
      id: d.id,
      name: d.name,
      cardCount: total,
      masteredCount,
      masteryPercent: total > 0 ? Math.round((masteredCount / total) * 100) : 0,
    };
  });
}

const CARD_TYPES: CardType[] = ['VOCABULARY', 'GRAMMAR', 'TENSES'];
const CARD_LEVELS: CardLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export interface BreakdownRow {
  key: string;
  total: number;
  mastered: number;
  due: number;
  new: number;
  masteryPercent: number;
}

/**
 * Per-category progress for the dashboard: one row per card type and one per
 * CEFR level, always including empty categories so the UI can render a
 * stable set of bars instead of a list that changes shape as cards are added.
 */
export async function getBreakdowns(userId: string) {
  const now = new Date();
  const owned = { deck: { ownerId: userId } };

  const [byTypeTotal, byTypeMastered, byTypeDue, byTypeNew, byLevelTotal, byLevelMastered, byLevelDue, byLevelNew] =
    await Promise.all([
      prisma.card.groupBy({ by: ['type'], where: owned, _count: { _all: true } }),
      prisma.card.groupBy({ by: ['type'], where: { ...owned, mastered: true }, _count: { _all: true } }),
      prisma.card.groupBy({ by: ['type'], where: { ...owned, dueDate: { lte: now } }, _count: { _all: true } }),
      prisma.card.groupBy({ by: ['type'], where: { ...owned, lastReviewedAt: null }, _count: { _all: true } }),
      prisma.card.groupBy({ by: ['level'], where: owned, _count: { _all: true } }),
      prisma.card.groupBy({ by: ['level'], where: { ...owned, mastered: true }, _count: { _all: true } }),
      prisma.card.groupBy({ by: ['level'], where: { ...owned, dueDate: { lte: now } }, _count: { _all: true } }),
      prisma.card.groupBy({ by: ['level'], where: { ...owned, lastReviewedAt: null }, _count: { _all: true } }),
    ]);

  const toMap = <T extends string>(rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, field: string) =>
    new Map<T, number>(rows.map((r) => [r[field] as T, r._count._all]));

  const build = <T extends string>(
    keys: T[],
    totals: Map<T, number>,
    mastered: Map<T, number>,
    due: Map<T, number>,
    fresh: Map<T, number>
  ): BreakdownRow[] =>
    keys.map((key) => {
      const total = totals.get(key) ?? 0;
      const masteredCount = mastered.get(key) ?? 0;
      return {
        key,
        total,
        mastered: masteredCount,
        due: due.get(key) ?? 0,
        new: fresh.get(key) ?? 0,
        masteryPercent: total > 0 ? Math.round((masteredCount / total) * 100) : 0,
      };
    });

  return {
    byType: build(
      CARD_TYPES,
      toMap<CardType>(byTypeTotal, 'type'),
      toMap<CardType>(byTypeMastered, 'type'),
      toMap<CardType>(byTypeDue, 'type'),
      toMap<CardType>(byTypeNew, 'type')
    ),
    byLevel: build(
      CARD_LEVELS,
      toMap<CardLevel>(byLevelTotal, 'level'),
      toMap<CardLevel>(byLevelMastered, 'level'),
      toMap<CardLevel>(byLevelDue, 'level'),
      toMap<CardLevel>(byLevelNew, 'level')
    ),
  };
}
