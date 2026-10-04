import { describe, expect, it } from 'vitest';
import { computeNextState, initialSrsState, isPassingRating, qualityFor } from '../src/services/sm2.service';

const NOW = new Date('2024-01-01T00:00:00Z');

describe('sm2.service', () => {
  it('starts new cards with a neutral ease factor and zero repetitions', () => {
    const state = initialSrsState();
    expect(state.repetitions).toBe(0);
    expect(state.intervalDays).toBe(0);
    expect(state.easeFactor).toBe(2.5);
    expect(state.mastered).toBe(false);
  });

  it('maps the five buttons onto the SM-2 quality scale', () => {
    expect(qualityFor('AGAIN')).toBe(0);
    expect(qualityFor('HARD')).toBe(1);
    expect(qualityFor('OK')).toBe(3);
    expect(qualityFor('GOOD')).toBe(4);
    expect(qualityFor('EASY')).toBe(5);
  });

  it('treats only quality >= 3 as a successful recall', () => {
    expect(isPassingRating('AGAIN')).toBe(false);
    expect(isPassingRating('HARD')).toBe(false);
    expect(isPassingRating('OK')).toBe(true);
    expect(isPassingRating('GOOD')).toBe(true);
    expect(isPassingRating('EASY')).toBe(true);
  });

  it('GOOD grows repetitions and interval following the 1 / 6 / EF*interval schedule', () => {
    const state = initialSrsState();

    const r1 = computeNextState(state, 'GOOD', NOW);
    expect(r1.repetitions).toBe(1);
    expect(r1.intervalDays).toBe(1);

    const r2 = computeNextState(r1, 'GOOD', NOW);
    expect(r2.repetitions).toBe(2);
    expect(r2.intervalDays).toBe(6);

    const r3 = computeNextState(r2, 'GOOD', NOW);
    expect(r3.repetitions).toBe(3);
    // 6 * 2.5 = 15 — GOOD (q=4) leaves the ease factor untouched.
    expect(r3.easeFactor).toBeCloseTo(2.5, 5);
    expect(r3.intervalDays).toBe(15);
  });

  it('orders the intervals OK < GOOD < EASY from the same state', () => {
    let state = initialSrsState();
    state = computeNextState(state, 'GOOD', NOW);
    state = computeNextState(state, 'GOOD', NOW); // repetitions = 2, interval = 6

    const ok = computeNextState(state, 'OK', NOW);
    const good = computeNextState(state, 'GOOD', NOW);
    const easy = computeNextState(state, 'EASY', NOW);

    expect(ok.intervalDays).toBeLessThan(good.intervalDays);
    expect(good.intervalDays).toBeLessThan(easy.intervalDays);
  });

  it('moves the ease factor down on OK, holds it on GOOD and raises it on EASY', () => {
    const state = initialSrsState();

    expect(computeNextState(state, 'OK', NOW).easeFactor).toBeCloseTo(2.36, 5);
    expect(computeNextState(state, 'GOOD', NOW).easeFactor).toBeCloseTo(2.5, 5);
    expect(computeNextState(state, 'EASY', NOW).easeFactor).toBeCloseTo(2.6, 5);
  });

  it.each(['AGAIN', 'HARD'] as const)('%s resets the schedule and queues a near-term relearn', (rating) => {
    let state = initialSrsState();
    state = computeNextState(state, 'GOOD', NOW);
    state = computeNextState(state, 'GOOD', NOW); // repetitions = 2, interval = 6

    const result = computeNextState(state, rating, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(0);
    expect(result.lapses).toBe(state.lapses + 1);
    expect(result.mastered).toBe(false);
    // Back within the hour, not tomorrow — the card is re-practised in the
    // same session.
    expect(result.dueDate.getTime() - NOW.getTime()).toBeLessThan(60 * 60 * 1000);
  });

  it('brings a HARD card back later than an AGAIN card', () => {
    const state = initialSrsState();
    const again = computeNextState(state, 'AGAIN', NOW);
    const hard = computeNextState(state, 'HARD', NOW);
    expect(hard.dueDate.getTime()).toBeGreaterThan(again.dueDate.getTime());
  });

  it('punishes the ease factor harder for AGAIN than for HARD', () => {
    const state = initialSrsState();
    const again = computeNextState(state, 'AGAIN', NOW);
    const hard = computeNextState(state, 'HARD', NOW);
    expect(again.easeFactor).toBeLessThan(hard.easeFactor);
  });

  it('never lets the ease factor drop below the SM-2 floor of 1.3', () => {
    let state = initialSrsState();
    for (let i = 0; i < 20; i++) {
      state = computeNextState(state, 'AGAIN', NOW);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('never lets the ease factor grow past the 3.2 ceiling', () => {
    let state = initialSrsState();
    for (let i = 0; i < 20; i++) {
      state = computeNextState(state, 'EASY', NOW);
    }
    expect(state.easeFactor).toBeLessThanOrEqual(3.2);
  });

  it('only marks a card mastered after a durable GOOD streak, never on a lapse', () => {
    let state = initialSrsState();

    // A single GOOD answer is nowhere near enough for mastery.
    const afterOneGood = computeNextState(state, 'GOOD', NOW);
    expect(afterOneGood.mastered).toBe(false);

    // A second consecutive GOOD is still not enough (only 2 repetitions).
    const afterTwoGood = computeNextState(afterOneGood, 'GOOD', NOW);
    expect(afterTwoGood.mastered).toBe(false);

    // The third consecutive GOOD clears both thresholds.
    state = computeNextState(afterTwoGood, 'GOOD', NOW);
    expect(state.repetitions).toBeGreaterThanOrEqual(3);
    expect(state.intervalDays).toBeGreaterThanOrEqual(7);
    expect(state.mastered).toBe(true);

    // A lapse takes mastery away again.
    expect(computeNextState(state, 'HARD', NOW).mastered).toBe(false);
    expect(computeNextState(state, 'AGAIN', NOW).mastered).toBe(false);
  });

  it('does not grant mastery on OK, however long the streak', () => {
    let state = initialSrsState();
    for (let i = 0; i < 6; i++) {
      state = computeNextState(state, 'OK', NOW);
      expect(state.mastered).toBe(false);
    }
  });

  it('schedules the due date intervalDays into the future', () => {
    const result = computeNextState(initialSrsState(), 'GOOD', NOW);
    const expected = NOW.getTime() + result.intervalDays * 24 * 60 * 60 * 1000;
    expect(result.dueDate.getTime()).toBe(expected);
  });
});
