export type Role = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';
// Five grading buttons mapped onto SM-2's 0-5 quality scale by the backend
// (AGAIN=0, HARD=1, OK=3, GOOD=4, EASY=5).
export type Rating = 'AGAIN' | 'HARD' | 'OK' | 'GOOD' | 'EASY';
export type CardType = 'VOCABULARY' | 'GRAMMAR' | 'TENSES';
export type CardLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type StudyMode = 'mixed' | 'review' | 'new';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  status?: UserStatus;
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: string | null;
  createdAt?: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  color: string | null;
  icon: string | null;
  ownerId: string;
  owned: boolean;
  cardCount: number;
  dueCount: number;
  /** Cards never shown by the scheduler - the pool for the "new" study mode. */
  newCount: number;
  /** Already-seen cards the scheduler brought back up today. */
  reviewCount: number;
  masteredCount: number;
  masteryPercent: number;
  lastStudiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  deckId: string;
  word: string;
  meaningEn: string | null;
  translationPl: string | null;
  exampleSentence: string | null;
  explanation: string | null;
  pronunciationIpa: string | null;
  partOfSpeech: string | null;
  type: CardType;
  level: CardLevel;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  dueDate: string;
  lapses: number;
  mastered: boolean;
  lastReviewedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StatsOverview {
  totalCards: number;
  masteredCards: number;
  newCards: number;
  dueToday: number;
  reviewsToday: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  totalReviews: number;
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: string | null;
  totalStudyTimeMs: number;
}

export interface DailyStat {
  date: string;
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  studyTimeMs: number;
  newCardsLearned: number;
}

export interface DeckProgress {
  id: string;
  name: string;
  cardCount: number;
  masteredCount: number;
  masteryPercent: number;
}

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  currentStreak: number;
  deckCount: number;
  reviewCount: number;
}

export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalDecks: number;
  totalCards: number;
  totalReviews: number;
  reviewsLast7Days: number;
}

export interface BreakdownRow {
  key: string;
  total: number;
  mastered: number;
  due: number;
  new: number;
  masteryPercent: number;
}

export interface Breakdowns {
  byType: BreakdownRow[];
  byLevel: BreakdownRow[];
}
