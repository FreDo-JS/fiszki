import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { TEST_ORIGIN } from './helpers';

const app = createApp();

async function registerAgent(email: string) {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .set('Origin', TEST_ORIGIN)
    .send({ username: email.split('@')[0], email, password: 'Password1', confirmPassword: 'Password1' });
  return agent;
}

type Agent = Awaited<ReturnType<typeof registerAgent>>;

async function createDeck(agent: Agent) {
  const res = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Zestaw' });
  return res.body.deck.id as string;
}

async function createCards(agent: Agent, deckId: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const res = await agent.post('/api/cards').set('Origin', TEST_ORIGIN).send({ deckId, word: `card-${i}` });
    ids.push(res.body.card.id);
  }
  return ids;
}

const review = (agent: Agent, cardId: string, rating: string) =>
  agent.post('/api/reviews').set('Origin', TEST_ORIGIN).send({ cardId, rating });

const undo = (agent: Agent) => agent.post('/api/reviews/undo').set('Origin', TEST_ORIGIN);

describe('Undoing a review', () => {
  it('restores the card exactly as it was and removes the review row', async () => {
    const agent = await registerAgent('undo1@example.com');
    const deckId = await createDeck(agent);
    const [cardId] = await createCards(agent, deckId, 1);

    await review(agent, cardId, 'GOOD'); // repetitions 1, interval 1
    const afterFirst = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });

    await review(agent, cardId, 'EASY');
    const afterSecond = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
    expect(afterSecond.repetitions).toBe(2);

    const res = await undo(agent);
    expect(res.status).toBe(200);
    expect(res.body.undoneRating).toBe('EASY');

    const restored = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
    expect(restored.repetitions).toBe(afterFirst.repetitions);
    expect(restored.intervalDays).toBe(afterFirst.intervalDays);
    expect(restored.easeFactor).toBeCloseTo(afterFirst.easeFactor, 6);
    expect(restored.lapses).toBe(afterFirst.lapses);
    expect(restored.mastered).toBe(afterFirst.mastered);
    expect(restored.dueDate.getTime()).toBe(afterFirst.dueDate.getTime());
    expect(restored.lastReviewedAt?.getTime()).toBe(afterFirst.lastReviewedAt?.getTime());

    expect(await prisma.review.count({ where: { cardId } })).toBe(1);
  });

  it('puts a brand new card back to never-seen', async () => {
    const agent = await registerAgent('undo2@example.com');
    const deckId = await createDeck(agent);
    const [cardId] = await createCards(agent, deckId, 1);

    await review(agent, cardId, 'GOOD');
    await undo(agent);

    const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
    expect(card.lastReviewedAt).toBeNull();
    expect(card.repetitions).toBe(0);

    // ...and the deck counts it as new again.
    const deck = await agent.get(`/api/decks/${deckId}`);
    expect(deck.body.deck.newCount).toBe(1);
  });

  it('rolls back the accuracy statistics', async () => {
    const agent = await registerAgent('undo3@example.com');
    const deckId = await createDeck(agent);
    const [a, b] = await createCards(agent, deckId, 2);

    await review(agent, a, 'GOOD');
    await review(agent, b, 'AGAIN');

    const before = await agent.get('/api/statistics');
    expect(before.body.overview.totalReviews).toBe(2);
    expect(before.body.overview.accuracy).toBe(50);

    await undo(agent); // takes back the AGAIN

    const after = await agent.get('/api/statistics');
    expect(after.body.overview.totalReviews).toBe(1);
    expect(after.body.overview.correctCount).toBe(1);
    expect(after.body.overview.incorrectCount).toBe(0);
    expect(after.body.overview.accuracy).toBe(100);
    expect(after.body.overview.reviewsToday).toBe(1);
  });

  it('takes the streak back down when the day had a single review', async () => {
    const agent = await registerAgent('undo4@example.com');
    const deckId = await createDeck(agent);
    const [cardId] = await createCards(agent, deckId, 1);

    await review(agent, cardId, 'GOOD');
    expect((await agent.get('/api/statistics')).body.overview.currentStreak).toBe(1);

    await undo(agent);
    const after = await agent.get('/api/statistics');
    expect(after.body.overview.currentStreak).toBe(0);
    expect(after.body.overview.lastStudyDate).toBeNull();
  });

  it('undoes only the latest review, one at a time', async () => {
    const agent = await registerAgent('undo5@example.com');
    const deckId = await createDeck(agent);
    const [a, b] = await createCards(agent, deckId, 2);

    await review(agent, a, 'GOOD');
    await review(agent, b, 'EASY');

    expect((await undo(agent)).body.undoneRating).toBe('EASY');
    expect((await undo(agent)).body.undoneRating).toBe('GOOD');

    // Nothing left to take back.
    expect((await undo(agent)).status).toBe(404);
  });

  it('never touches another user’s review', async () => {
    const owner = await registerAgent('undo-owner@example.com');
    const deckId = await createDeck(owner);
    const [cardId] = await createCards(owner, deckId, 1);
    await review(owner, cardId, 'GOOD');

    const stranger = await registerAgent('undo-stranger@example.com');
    expect((await undo(stranger)).status).toBe(404);

    // The owner's review is still there.
    expect(await prisma.review.count({ where: { cardId } })).toBe(1);
  });
});

describe('Daily new-card limit', () => {
  async function setLimit(agent: Agent, dailyNewLimit: number) {
    const res = await agent.patch('/api/auth/me/settings').set('Origin', TEST_ORIGIN).send({ dailyNewLimit });
    expect(res.status).toBe(200);
    return res;
  }

  it('defaults to 20 and is reported on the profile', async () => {
    const agent = await registerAgent('limit1@example.com');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.dailyNewLimit).toBe(20);
  });

  it('caps how many never-seen cards the queue offers', async () => {
    const agent = await registerAgent('limit2@example.com');
    const deckId = await createDeck(agent);
    await createCards(agent, deckId, 6);
    await setLimit(agent, 2);

    const queue = await agent.get(`/api/study/${deckId}`).query({ mode: 'new' });
    expect(queue.body.newAllowance).toBe(2);
    expect(queue.body.cards).toHaveLength(2);
  });

  it('shrinks the allowance as new cards are actually started', async () => {
    const agent = await registerAgent('limit3@example.com');
    const deckId = await createDeck(agent);
    const ids = await createCards(agent, deckId, 5);
    await setLimit(agent, 3);

    await review(agent, ids[0], 'GOOD');
    await review(agent, ids[1], 'GOOD');

    const queue = await agent.get(`/api/study/${deckId}`).query({ mode: 'new' });
    expect(queue.body.newAllowance).toBe(1);
    expect(queue.body.cards).toHaveLength(1);
  });

  it('counts the allowance across decks, so hopping between them cannot bypass it', async () => {
    const agent = await registerAgent('limit4@example.com');
    const deckA = await createDeck(agent);
    const deckB = await createDeck(agent);
    const idsA = await createCards(agent, deckA, 2);
    await createCards(agent, deckB, 2);
    await setLimit(agent, 2);

    await review(agent, idsA[0], 'GOOD');
    await review(agent, idsA[1], 'GOOD');

    const other = await agent.get(`/api/study/${deckB}`).query({ mode: 'new' });
    expect(other.body.newAllowance).toBe(0);
    expect(other.body.cards).toHaveLength(0);
  });

  it('never rations repetitions, only new cards', async () => {
    const agent = await registerAgent('limit5@example.com');
    const deckId = await createDeck(agent);
    const ids = await createCards(agent, deckId, 3);
    await setLimit(agent, 3);

    for (const id of ids) await review(agent, id, 'GOOD');
    // The whole allowance is spent, and all three are now due again.
    await prisma.card.updateMany({
      where: { deckId },
      data: { dueDate: new Date(Date.now() - 60_000) },
    });

    const queue = await agent.get(`/api/study/${deckId}`).query({ mode: 'review' });
    expect(queue.body.newAllowance).toBe(0);
    expect(queue.body.cards).toHaveLength(3);
  });

  it('switches new cards off entirely at zero', async () => {
    const agent = await registerAgent('limit6@example.com');
    const deckId = await createDeck(agent);
    await createCards(agent, deckId, 3);
    await setLimit(agent, 0);

    const queue = await agent.get(`/api/study/${deckId}`).query({ mode: 'mixed' });
    expect(queue.body.cards).toHaveLength(0);
  });

  it('rejects a limit outside the allowed range', async () => {
    const agent = await registerAgent('limit7@example.com');
    expect((await agent.patch('/api/auth/me/settings').set('Origin', TEST_ORIGIN).send({ dailyNewLimit: -1 })).status).toBe(400);
    expect((await agent.patch('/api/auth/me/settings').set('Origin', TEST_ORIGIN).send({ dailyNewLimit: 500 })).status).toBe(400);
  });

  it('frees the allowance again when the review that used it is undone', async () => {
    const agent = await registerAgent('limit8@example.com');
    const deckId = await createDeck(agent);
    const ids = await createCards(agent, deckId, 3);
    await setLimit(agent, 1);

    await review(agent, ids[0], 'GOOD');
    expect((await agent.get(`/api/study/${deckId}`).query({ mode: 'new' })).body.newAllowance).toBe(0);

    await undo(agent);
    expect((await agent.get(`/api/study/${deckId}`).query({ mode: 'new' })).body.newAllowance).toBe(1);
  });
});
