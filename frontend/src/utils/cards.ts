import { CardLevel, CardType, Rating, StudyMode } from '../api/types';

export const CARD_TYPES: CardType[] = ['VOCABULARY', 'GRAMMAR', 'TENSES'];
export const CARD_LEVELS: CardLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  VOCABULARY: 'Słownictwo',
  GRAMMAR: 'Gramatyka',
  TENSES: 'Czasy',
};

/** Badge tone per card type, so a type is recognisable at a glance. */
export const CARD_TYPE_TONE: Record<CardType, 'accent' | 'teal' | 'warning'> = {
  VOCABULARY: 'accent',
  GRAMMAR: 'teal',
  TENSES: 'warning',
};

export const STUDY_MODE_LABEL: Record<StudyMode, string> = {
  mixed: 'Wszystko',
  review: 'Powtórki',
  new: 'Nowe',
};

/**
 * The five grading buttons, in the order they are shown. `quality` is the
 * SM-2 grade the backend derives from each rating — displayed in the UI so
 * the scheduling is not a black box. The shortcut is the digit key.
 */
export interface RatingMeta {
  rating: Rating;
  label: string;
  hint: string;
  quality: number;
  key: string;
  variant: 'danger' | 'caution' | 'warning' | 'teal' | 'success';
}

export const RATINGS: RatingMeta[] = [
  { rating: 'AGAIN', label: 'Nie pamiętam', hint: 'zupełnie nie wiedziałem', quality: 0, key: '1', variant: 'danger' },
  { rating: 'HARD', label: 'Ledwo', hint: 'błąd, ale odpowiedź była znajoma', quality: 1, key: '2', variant: 'caution' },
  { rating: 'OK', label: 'Z trudem', hint: 'dobrze, ale z wysiłkiem', quality: 3, key: '3', variant: 'warning' },
  { rating: 'GOOD', label: 'Dobrze', hint: 'dobrze, po chwili wahania', quality: 4, key: '4', variant: 'teal' },
  { rating: 'EASY', label: 'Łatwo', hint: 'od razu i bez wahania', quality: 5, key: '5', variant: 'success' },
];

/** SM-2 counts a review as recall only from quality 3 upwards. */
export function isPassingRating(rating: Rating): boolean {
  return (RATINGS.find((r) => r.rating === rating)?.quality ?? 0) >= 3;
}

/** Human-readable "next review in …" for the card footer. */
export function formatInterval(days: number): string {
  if (days <= 0) return 'dziś';
  if (days === 1) return 'za 1 dzień';
  if (days < 5) return `za ${days} dni`;
  if (days < 31) return `za ${days} dni`;
  const months = Math.round(days / 30);
  if (months <= 1) return 'za miesiąc';
  if (months < 5) return `za ${months} miesiące`;
  if (months < 12) return `za ${months} miesięcy`;
  const years = Math.round(days / 365);
  return years <= 1 ? 'za rok' : `za ${years} lata`;
}
