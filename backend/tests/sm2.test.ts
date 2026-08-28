import { describe, expect, it } from 'vitest';
import { computeNextState, initialSrsState } from '../src/services/sm2.service';

describe('sm2.service', () => {
  it('starts new cards with a neutral ease factor and zero repetitions', () => {
    const state = initialSrsState();
    expect(state.repetitions).toBe(0);
    expect(state.intervalDays).toBe(0);
    expect(state.easeFactor).toBe(2.5);
    expect(state.mastered).toBe(false);
  });

  it('GOOD grows repetitions and interval following the 1 / 6 / EF*interval schedule', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    let state = initialSrsState();

    const r1 = computeNextState(state, 'GOOD', now);
    expect(r1.repetitions).toBe(1);
    expect(r1.intervalDays).toBe(1);

    const r2 = computeNextState(r1, 'GOOD', now);
    expect(r2.repetitions).toBe(2);
    expect(r2.intervalDays).toBe(6);

    const r3 = computeNextState(r2, 'GOOD', now);
    expect(r3.repetitions).toBe(3);
    expect(r3.intervalDays).toBeGreaterThan(6);
  });

  it('AGAIN resets repetitions and interval, and schedules a near-term relearn', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    let state = initialSrsState();
    state = computeNextState(state, 'GOOD', now);
    state = computeNextState(state, 'GOOD', now); // repetitions = 2, interval = 6

    const result = computeNextState(state, 'AGAIN', now);
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(0);
    expect(result.lapses).toBe(state.lapses + 1);
    expect(result.mastered).toBe(false);
    // Due again within the hour, not tomorrow — "wraca znacznie szybciej".
    expect(result.dueDate.getTime() - now.getTime()).toBeLessThan(60 * 60 * 1000);
  });

  it('HARD grows the interval more slowly than GOOD from the same state', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    let state = initialSrsState();
    state = computeNextState(state, 'GOOD', now);
    state = computeNextState(state, 'GOOD', now); // repetitions = 2, interval = 6

    const hard = computeNextState(state, 'HARD', now);
    const good = computeNextState(state, 'GOOD', now);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
  });

  it('never lets the ease factor drop below the SM-2 floor of 1.3', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    let state = initialSrsState();
    for (let i = 0; i < 20; i++) {
      state = computeNextState(state, 'AGAIN', now);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('only marks a card mastered after a durable GOOD streak, never on AGAIN or HARD', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    let state = initialSrsState();

    // A single GOOD answer is nowhere near enough for mastery.
    const afterOneGood = computeNextState(state, 'GOOD', now);
    expect(afterOneGood.mastered).toBe(false);

    // A second consecutive GOOD is still not enough (only 2 repetitions).
    const afterTwoGood = computeNextState(afterOneGood, 'GOOD', now);
    expect(afterTwoGood.mastered).toBe(false);

    // The third consecutive GOOD clears both thresholds.
    state = computeNextState(afterTwoGood, 'GOOD', now);
    expect(state.repetitions).toBeGreaterThanOrEqual(3);
    expect(state.intervalDays).toBeGreaterThanOrEqual(7);
    expect(state.mastered).toBe(true);

    // A single lapse immediately revokes mastery, even though the card was
    // mastered a moment ago — mastery reflects current retention.
    const afterLapse = computeNextState(state, 'AGAIN', now);
    expect(afterLapse.mastered).toBe(false);

    const afterHard = computeNextState(state, 'HARD', now);
    expect(afterHard.mastered).toBe(false);
  });
});
