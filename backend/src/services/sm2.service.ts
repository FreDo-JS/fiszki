// Spaced-repetition engine, inspired by SuperMemo SM-2 (as used by Anki),
// adapted to a 3-button grading scale instead of SM-2's original 0-5 scale.
//
// Rating -> SM-2 quality mapping:
//   AGAIN -> 0 (complete blackout, card is relearned from scratch)
//   HARD  -> 3 (recalled, but with real difficulty)
//   GOOD  -> 5 (recalled correctly and confidently)
//
// This module is pure and framework-free by design: it takes the card's
// current SRS state plus a rating and returns the next state. It never
// touches the database or the request/response cycle, which keeps the
// algorithm independently testable and reusable.

export type Rating = 'AGAIN' | 'HARD' | 'GOOD';

export interface SrsState {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
  mastered: boolean;
}

export interface SrsResult extends SrsState {
  dueDate: Date;
}

const MIN_EASE_FACTOR = 1.3;
const MAX_EASE_FACTOR = 3.2;
const RELEARN_MINUTES = 10;

// A card only becomes "mastered" once it has demonstrated durable recall:
// several consecutive correct reviews AND a long enough interval that a
// single lucky guess cannot qualify. Any AGAIN or HARD answer keeps (or
// resets) it as not-mastered, no matter how the card looked before —
// mastery reflects current retention, not a one-time best result.
//
// The interval floor is deliberately below Anki's 21-day "mature card"
// mark: with 21 days the third GOOD review lands on a 17-day interval, so
// the earliest possible mastery was the 4th review ~24 calendar days in,
// which made the "mastered" counter look permanently stuck at zero. At 7
// days mastery arrives on the 3rd consecutive GOOD (~1 week), which is
// still three separate successful recalls on three different days.
const MASTERY_MIN_REPETITIONS = 3;
const MASTERY_MIN_INTERVAL_DAYS = 7;

function clampEase(ef: number): number {
  return Math.min(MAX_EASE_FACTOR, Math.max(MIN_EASE_FACTOR, ef));
}

function qualityFor(rating: Rating): number {
  switch (rating) {
    case 'AGAIN':
      return 0;
    case 'HARD':
      return 3;
    case 'GOOD':
      return 5;
  }
}

// Classic SM-2 ease factor update: EF' = EF + (0.1 - (5-q)(0.08 + (5-q)*0.02))
function nextEaseFactor(oldEase: number, rating: Rating): number {
  const q = qualityFor(rating);
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  return clampEase(oldEase + delta);
}

export function computeNextState(current: SrsState, rating: Rating, now: Date = new Date()): SrsResult {
  const easeFactor = nextEaseFactor(current.easeFactor, rating);

  if (rating === 'AGAIN') {
    const dueDate = new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000);
    return {
      repetitions: 0,
      intervalDays: 0,
      easeFactor,
      lapses: current.lapses + 1,
      mastered: false,
      dueDate,
    };
  }

  const repetitions = current.repetitions + 1;
  let intervalDays: number;

  if (rating === 'HARD') {
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.max(1, Math.round(current.intervalDays * easeFactor * 0.8));
  } else {
    // GOOD
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(current.intervalDays * easeFactor));
  }

  const mastered =
    rating === 'GOOD' && repetitions >= MASTERY_MIN_REPETITIONS && intervalDays >= MASTERY_MIN_INTERVAL_DAYS;

  const dueDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    repetitions,
    intervalDays,
    easeFactor,
    lapses: current.lapses,
    mastered,
    dueDate,
  };
}

export function initialSrsState(): SrsState {
  return { repetitions: 0, intervalDays: 0, easeFactor: 2.5, lapses: 0, mastered: false };
}
