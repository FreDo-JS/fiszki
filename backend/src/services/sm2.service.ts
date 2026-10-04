// Spaced-repetition engine implementing the classic SuperMemo SM-2 algorithm
// on its original 0-5 quality scale, exposed through five grading buttons:
//
//   Rating -> SM-2 quality
//   AGAIN -> 0  complete blackout
//   HARD  -> 1  wrong, but the answer felt familiar
//   OK    -> 3  recalled correctly with serious difficulty
//   GOOD  -> 4  recalled correctly after some hesitation
//   EASY  -> 5  recalled instantly
//
// SM-2 treats quality < 3 as a failed recall: repetitions reset and the card
// returns almost immediately. Quality >= 3 advances the schedule along the
// 1 -> 6 -> interval * easeFactor progression, with the ease factor nudged
// up or down by the grade.
//
// This module is pure and framework-free by design: it takes the card's
// current SRS state plus a rating and returns the next state. It never
// touches the database or the request/response cycle, which keeps the
// algorithm independently testable and reusable.

export type Rating = 'AGAIN' | 'HARD' | 'OK' | 'GOOD' | 'EASY';

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

// SM-2 sends failed cards back to the very start of the schedule. Rather
// than wait a full day (the paper's "repeat on the same day"), a lapse is
// re-queued within the hour so the user still practises it in this session;
// how soon depends on how badly it went.
const RELEARN_MINUTES: Record<'AGAIN' | 'HARD', number> = {
  AGAIN: 10,
  HARD: 20,
};

// Multipliers applied on top of interval * easeFactor, mirroring how modern
// SM-2 descendants separate "barely remembered" from "instant recall".
const INTERVAL_MODIFIER: Record<'OK' | 'GOOD' | 'EASY', number> = {
  OK: 0.8,
  GOOD: 1,
  EASY: 1.3,
};

// The first two successful intervals are fixed by SM-2 (1 day, then 6 days).
// EASY is allowed to skip ahead slightly, since "instant recall" on a brand
// new card is a strong signal that one day is too soon.
const FIRST_INTERVAL: Record<'OK' | 'GOOD' | 'EASY', number> = { OK: 1, GOOD: 1, EASY: 2 };
const SECOND_INTERVAL: Record<'OK' | 'GOOD' | 'EASY', number> = { OK: 4, GOOD: 6, EASY: 8 };

// A card only becomes "mastered" once it has demonstrated durable recall:
// several consecutive confident reviews AND a long enough interval that a
// single lucky guess cannot qualify. Anything below GOOD keeps (or resets)
// it as not-mastered, no matter how the card looked before — mastery
// reflects current retention, not a one-time best result.
//
// The interval floor is deliberately below Anki's 21-day "mature card"
// mark: with 21 days the third GOOD review lands on a 17-day interval, so
// the earliest possible mastery was the 4th review ~24 calendar days in,
// which made the "mastered" counter look permanently stuck at zero. At 7
// days mastery arrives on the 3rd consecutive GOOD (~1 week), which is
// still three separate successful recalls on three different days.
const MASTERY_MIN_REPETITIONS = 3;
const MASTERY_MIN_INTERVAL_DAYS = 7;

const QUALITY: Record<Rating, number> = {
  AGAIN: 0,
  HARD: 1,
  OK: 3,
  GOOD: 4,
  EASY: 5,
};

/** SM-2 counts only quality >= 3 as a successful recall. */
export function isPassingRating(rating: Rating): boolean {
  return QUALITY[rating] >= 3;
}

export function qualityFor(rating: Rating): number {
  return QUALITY[rating];
}

function clampEase(ef: number): number {
  return Math.min(MAX_EASE_FACTOR, Math.max(MIN_EASE_FACTOR, ef));
}

// Classic SM-2 ease factor update: EF' = EF + (0.1 - (5-q)(0.08 + (5-q)*0.02))
// q=5 -> +0.10, q=4 -> 0.00, q=3 -> -0.14, q=1 -> -0.54, q=0 -> -0.80
function nextEaseFactor(oldEase: number, rating: Rating): number {
  const q = QUALITY[rating];
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  return clampEase(oldEase + delta);
}

export function computeNextState(current: SrsState, rating: Rating, now: Date = new Date()): SrsResult {
  const easeFactor = nextEaseFactor(current.easeFactor, rating);

  if (rating === 'AGAIN' || rating === 'HARD') {
    const dueDate = new Date(now.getTime() + RELEARN_MINUTES[rating] * 60 * 1000);
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

  if (repetitions === 1) {
    intervalDays = FIRST_INTERVAL[rating];
  } else if (repetitions === 2) {
    intervalDays = SECOND_INTERVAL[rating];
  } else {
    intervalDays = Math.max(1, Math.round(current.intervalDays * easeFactor * INTERVAL_MODIFIER[rating]));
  }

  const mastered =
    (rating === 'GOOD' || rating === 'EASY') &&
    repetitions >= MASTERY_MIN_REPETITIONS &&
    intervalDays >= MASTERY_MIN_INTERVAL_DAYS;

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
