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

async function createDeck(agent: Agent, name = 'Zestaw testowy') {
  const res = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name });
  expect(res.status).toBe(201);
  return res.body.deck.id as string;
}

async function createCard(agent: Agent, deckId: string, body: Record<string, unknown>) {
  const res = await agent.post('/api/cards').set('Origin', TEST_ORIGIN).send({ deckId, ...body });
  expect(res.status).toBe(201);
  return res.body.card;
}

function review(agent: Agent, cardId: string, rating: string) {
  return agent.post('/api/reviews').set('Origin', TEST_ORIGIN).send({ cardId, rating });
}

describe('Study queue', () => {
  it('serves new cards in the "new" mode and nothing in "review" until something has been studied', async () => {
    const agent = await registerAgent('queue1@example.com');
    const deckId = await createDeck(agent);
    await createCard(agent, deckId, { word: 'alpha' });
    await createCard(agent, deckId, { word: 'beta' });

    const fresh = await agent.get(`/api/study/${deckId}`).query({ mode: 'new' });
    expect(fresh.status).toBe(200);
    expect(fresh.body.cards).toHaveLength(2);

    // Nothing has been graded yet, so the scheduler owes no repetitions —
    // a brand new card is "due" by date but is not a review.
    const review = await agent.get(`/api/study/${deckId}`).query({ mode: 'review' });
    expect(review.body.cards).toHaveLength(0);
    expect(review.body.total).toBe(0);
  });

  it('moves a lapsed card into the review queue and out of the new queue', async () => {
    const agent = await registerAgent('queue2@example.com');
    const deckId = await createDeck(agent);
    const card = await createCard(agent, deckId, { word: 'gamma' });

    // AGAIN schedules the card ~10 minutes out, so it is a review that is not
    // due yet — neither queue should offer it.
    expect((await review(agent, card.id, 'AGAIN')).status).toBe(201);

    const newQueue = await agent.get(`/api/study/${deckId}`).query({ mode: 'new' });
    expect(newQueue.body.cards).toHaveLength(0);

    const reviewQueue = await agent.get(`/api/study/${deckId}`).query({ mode: 'review' });
    expect(reviewQueue.body.cards).toHaveLength(0);

    // Pull the due date into the past, the way the clock would.
    await prisma.card.update({ where: { id: card.id }, data: { dueDate: new Date(Date.now() - 60_000) } });

    const dueNow = await agent.get(`/api/study/${deckId}`).query({ mode: 'review' });
    expect(dueNow.body.cards).toHaveLength(1);
    expect(dueNow.body.cards[0].id).toBe(card.id);
  });

  it('filters the queue by card type and by CEFR level', async () => {
    const agent = await registerAgent('queue3@example.com');
    const deckId = await createDeck(agent);
    await createCard(agent, deckId, { word: 'słowo', type: 'VOCABULARY', level: 'A1' });
    await createCard(agent, deckId, { word: 'Present Perfect', type: 'GRAMMAR', level: 'B1' });
    await createCard(agent, deckId, { word: 'Past Continuous', type: 'TENSES', level: 'B1' });

    const grammar = await agent.get(`/api/study/${deckId}`).query({ type: 'GRAMMAR' });
    expect(grammar.body.cards.map((c: { word: string }) => c.word)).toEqual(['Present Perfect']);

    const b1 = await agent.get(`/api/study/${deckId}`).query({ level: 'B1' });
    expect(b1.body.cards).toHaveLength(2);

    const both = await agent.get(`/api/study/${deckId}`).query({ type: 'TENSES', level: 'B1' });
    expect(both.body.cards.map((c: { word: string }) => c.word)).toEqual(['Past Continuous']);

    const none = await agent.get(`/api/study/${deckId}`).query({ type: 'TENSES', level: 'A1' });
    expect(none.body.cards).toHaveLength(0);
  });

  it('rejects an unknown study mode or level', async () => {
    const agent = await registerAgent('queue4@example.com');
    const deckId = await createDeck(agent);

    expect((await agent.get(`/api/study/${deckId}`).query({ mode: 'everything' })).status).toBe(400);
    expect((await agent.get(`/api/study/${deckId}`).query({ level: 'D7' })).status).toBe(400);
  });
});

describe('Review submission (SM-2)', () => {
  it('advances the schedule on GOOD and records the SM-2 quality', async () => {
    const agent = await registerAgent('review1@example.com');
    const deckId = await createDeck(agent);
    const card = await createCard(agent, deckId, { word: 'remember' });

    const res = await review(agent, card.id, 'GOOD');
    expect(res.status).toBe(201);
    expect(res.body.card.repetitions).toBe(1);
    expect(res.body.card.intervalDays).toBe(1);
    expect(res.body.card.easeFactor).toBeCloseTo(2.5, 5); // q=4 leaves ease alone

    const stored = await prisma.review.findFirst({ where: { cardId: card.id } });
    expect(stored?.rating).toBe('GOOD');
    expect(stored?.quality).toBe(4);
    expect(stored?.prevInterval).toBe(0);
    expect(stored?.newInterval).toBe(1);
  });

  it('treats HARD as a lapse, not as a pass', async () => {
    const agent = await registerAgent('review2@example.com');
    const deckId = await createDeck(agent);
    const card = await createCard(agent, deckId, { word: 'struggle' });

    await review(agent, card.id, 'GOOD');
    await review(agent, card.id, 'GOOD'); // repetitions = 2, interval = 6

    const res = await review(agent, card.id, 'HARD');
    expect(res.body.card.repetitions).toBe(0);
    expect(res.body.card.intervalDays).toBe(0);
    expect(res.body.card.lapses).toBe(1);
    expect(res.body.card.mastered).toBe(false);
    // q=1 costs 0.54 of ease.
    expect(res.body.card.easeFactor).toBeCloseTo(1.96, 2);

    const stored = await prisma.review.findFirst({ where: { cardId: card.id, rating: 'HARD' } });
    expect(stored?.quality).toBe(1);
  });

  it('gives EASY a longer interval than OK from the same state', async () => {
    const agent = await registerAgent('review3@example.com');
    const deckId = await createDeck(agent);
    const easyCard = await createCard(agent, deckId, { word: 'easy-one' });
    const okCard = await createCard(agent, deckId, { word: 'ok-one' });

    const easy = await review(agent, easyCard.id, 'EASY');
    const ok = await review(agent, okCard.id, 'OK');

    expect(easy.body.card.intervalDays).toBeGreaterThan(ok.body.card.intervalDays);
    expect(easy.body.card.easeFactor).toBeGreaterThan(ok.body.card.easeFactor);
  });

  it('counts only quality >= 3 as correct in the accuracy statistic', async () => {
    const agent = await registerAgent('review4@example.com');
    const deckId = await createDeck(agent);
    const a = await createCard(agent, deckId, { word: 'one' });
    const b = await createCard(agent, deckId, { word: 'two' });
    const c = await createCard(agent, deckId, { word: 'three' });
    const d = await createCard(agent, deckId, { word: 'four' });

    await review(agent, a.id, 'GOOD'); // pass
    await review(agent, b.id, 'EASY'); // pass
    await review(agent, c.id, 'HARD'); // fail (q=1)
    await review(agent, d.id, 'AGAIN'); // fail (q=0)

    const stats = await agent.get('/api/statistics');
    expect(stats.status).toBe(200);
    expect(stats.body.overview.totalReviews).toBe(4);
    expect(stats.body.overview.correctCount).toBe(2);
    expect(stats.body.overview.incorrectCount).toBe(2);
    expect(stats.body.overview.accuracy).toBe(50);
  });

  it('starts the daily streak on the first graded card', async () => {
    const agent = await registerAgent('review5@example.com');
    const deckId = await createDeck(agent);
    const card = await createCard(agent, deckId, { word: 'streak' });

    expect((await agent.get('/api/statistics')).body.overview.currentStreak).toBe(0);
    await review(agent, card.id, 'GOOD');

    const after = await agent.get('/api/statistics');
    expect(after.body.overview.currentStreak).toBe(1);
    expect(after.body.overview.reviewsToday).toBe(1);
  });

  it('rejects a rating outside the five-button scale', async () => {
    const agent = await registerAgent('review6@example.com');
    const deckId = await createDeck(agent);
    const card = await createCard(agent, deckId, { word: 'bogus' });

    const res = await agent
      .post('/api/reviews')
      .set('Origin', TEST_ORIGIN)
      .send({ cardId: card.id, rating: 'PERFECT' });
    expect(res.status).toBe(400);
  });
});

describe('Statistics breakdowns', () => {
  it('groups progress by card type and CEFR level, including empty categories', async () => {
    const agent = await registerAgent('breakdown@example.com');
    const deckId = await createDeck(agent);
    await createCard(agent, deckId, { word: 'słowo', type: 'VOCABULARY', level: 'A1' });
    await createCard(agent, deckId, { word: 'reguła', type: 'GRAMMAR', level: 'B1' });
    await createCard(agent, deckId, { word: 'czas', type: 'TENSES', level: 'B1' });

    const res = await agent.get('/api/statistics/breakdowns');
    expect(res.status).toBe(200);

    // Every category is present even when empty, so the UI can draw a stable
    // set of bars.
    expect(res.body.byType.map((r: { key: string }) => r.key)).toEqual(['VOCABULARY', 'GRAMMAR', 'TENSES']);
    expect(res.body.byLevel.map((r: { key: string }) => r.key)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);

    const byType = Object.fromEntries(res.body.byType.map((r: { key: string }) => [r.key, r]));
    expect(byType.VOCABULARY.total).toBe(1);
    expect(byType.GRAMMAR.total).toBe(1);
    expect(byType.VOCABULARY.new).toBe(1);

    const byLevel = Object.fromEntries(res.body.byLevel.map((r: { key: string }) => [r.key, r]));
    expect(byLevel.B1.total).toBe(2);
    expect(byLevel.A2.total).toBe(0);
    expect(byLevel.A2.masteryPercent).toBe(0);
  });
});
