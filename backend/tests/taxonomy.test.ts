import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
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

async function createDeck(agent: Agent, name = 'Zestaw') {
  const res = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name });
  return res.body.deck.id as string;
}

describe('Card taxonomy', () => {
  it('defaults a card to vocabulary at A1 when the client says nothing', async () => {
    const agent = await registerAgent('tax1@example.com');
    const deckId = await createDeck(agent);

    const res = await agent.post('/api/cards').set('Origin', TEST_ORIGIN).send({ deckId, word: 'default' });
    expect(res.status).toBe(201);
    expect(res.body.card.type).toBe('VOCABULARY');
    expect(res.body.card.level).toBe('A1');
    expect(res.body.card.explanation).toBeNull();
  });

  it('stores the type, level and explanation given by the client', async () => {
    const agent = await registerAgent('tax2@example.com');
    const deckId = await createDeck(agent);

    const res = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({
        deckId,
        word: 'Present Perfect',
        meaningEn: 'have / has + V3',
        explanation: 'Czynność zakończona ze skutkiem teraz.',
        type: 'GRAMMAR',
        level: 'B1',
      });

    expect(res.status).toBe(201);
    expect(res.body.card.type).toBe('GRAMMAR');
    expect(res.body.card.level).toBe('B1');
    expect(res.body.card.explanation).toBe('Czynność zakończona ze skutkiem teraz.');
  });

  it('rejects a type or level outside the allowed set', async () => {
    const agent = await registerAgent('tax3@example.com');
    const deckId = await createDeck(agent);

    const badType = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId, word: 'x', type: 'IDIOMS' });
    expect(badType.status).toBe(400);

    const badLevel = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId, word: 'x', level: 'C2' });
    expect(badLevel.status).toBe(400);
  });

  it('filters the card list by type and level', async () => {
    const agent = await registerAgent('tax4@example.com');
    const deckId = await createDeck(agent);
    const send = (body: Record<string, unknown>) =>
      agent.post('/api/cards').set('Origin', TEST_ORIGIN).send({ deckId, ...body });

    await send({ word: 'word-a1', type: 'VOCABULARY', level: 'A1' });
    await send({ word: 'rule-b1', type: 'GRAMMAR', level: 'B1' });
    await send({ word: 'tense-b1', type: 'TENSES', level: 'B1' });

    const grammar = await agent.get('/api/cards').query({ deckId, type: 'GRAMMAR' });
    expect(grammar.body.total).toBe(1);
    expect(grammar.body.items[0].word).toBe('rule-b1');

    const b1 = await agent.get('/api/cards').query({ deckId, level: 'B1' });
    expect(b1.body.total).toBe(2);

    const combined = await agent.get('/api/cards').query({ deckId, type: 'TENSES', level: 'B1' });
    expect(combined.body.total).toBe(1);
    expect(combined.body.items[0].word).toBe('tense-b1');
  });

  it('finds a card by text inside its explanation', async () => {
    const agent = await registerAgent('tax5@example.com');
    const deckId = await createDeck(agent);
    await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId, word: 'passive', explanation: 'Używamy, gdy ważniejsza jest czynność niż wykonawca.' });

    const res = await agent.get('/api/cards').query({ deckId, search: 'wykonawca' });
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].word).toBe('passive');
  });
});

describe('Deck duplication', () => {
  it('carries the type, level and explanation over to the copy', async () => {
    // Regression guard: the first version of the taxonomy feature dropped
    // these fields on duplicate, so every copied grammar deck reported itself
    // as vocabulary at A1.
    const owner = await registerAgent('dup-owner@example.com');
    const deckId = await createDeck(owner, 'Gramatyka');
    await owner
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({
        deckId,
        word: 'First Conditional',
        explanation: 'If + Present Simple, will + bezokolicznik.',
        type: 'GRAMMAR',
        level: 'B1',
      });

    const copy = await owner.post(`/api/decks/${deckId}/duplicate`).set('Origin', TEST_ORIGIN);
    expect(copy.status).toBe(201);

    const cards = await owner.get('/api/cards').query({ deckId: copy.body.deck.id });
    expect(cards.body.total).toBe(1);
    const copied = cards.body.items[0];
    expect(copied.type).toBe('GRAMMAR');
    expect(copied.level).toBe('B1');
    expect(copied.explanation).toBe('If + Present Simple, will + bezokolicznik.');
    // The learner starts the schedule from scratch, though.
    expect(copied.repetitions).toBe(0);
    expect(copied.lastReviewedAt).toBeNull();
  });
});

describe('Deck counters', () => {
  it('separates cards never seen (newCount) from repetitions actually due (reviewCount)', async () => {
    const agent = await registerAgent('counters@example.com');
    const deckId = await createDeck(agent);
    const first = await agent.post('/api/cards').set('Origin', TEST_ORIGIN).send({ deckId, word: 'one' });
    await agent.post('/api/cards').set('Origin', TEST_ORIGIN).send({ deckId, word: 'two' });

    const before = await agent.get(`/api/decks/${deckId}`);
    expect(before.body.deck.newCount).toBe(2);
    // Both are "due" by date, but neither is a repetition the scheduler owes.
    expect(before.body.deck.dueCount).toBe(2);
    expect(before.body.deck.reviewCount).toBe(0);

    await agent
      .post('/api/reviews')
      .set('Origin', TEST_ORIGIN)
      .send({ cardId: first.body.card.id, rating: 'GOOD' });

    const after = await agent.get(`/api/decks/${deckId}`);
    expect(after.body.deck.newCount).toBe(1);
    expect(after.body.deck.reviewCount).toBe(0); // scheduled a day out
  });
});

describe('Import / export', () => {
  it('round-trips the new columns through CSV', async () => {
    const agent = await registerAgent('csv1@example.com');
    const sourceDeck = await createDeck(agent, 'Źródło');
    await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({
        deckId: sourceDeck,
        word: 'Past Perfect',
        meaningEn: 'had + V3',
        translationPl: 'czas zaprzeszły',
        explanation: 'Czynność przed inną czynnością przeszłą.',
        type: 'TENSES',
        level: 'B2',
      });

    const exported = await agent.get(`/api/decks/${sourceDeck}/export`).query({ format: 'csv' });
    expect(exported.status).toBe(200);
    expect(exported.text).toContain('explanation');
    expect(exported.text).toContain('TENSES');
    expect(exported.text).toContain('B2');

    const targetDeck = await createDeck(agent, 'Cel');
    const imported = await agent
      .post(`/api/decks/${targetDeck}/import`)
      .set('Origin', TEST_ORIGIN)
      .send({ format: 'csv', content: exported.text });
    expect(imported.status).toBe(200);
    expect(imported.body.imported).toBe(1);

    const cards = await agent.get('/api/cards').query({ deckId: targetDeck });
    const card = cards.body.items[0];
    expect(card.type).toBe('TENSES');
    expect(card.level).toBe('B2');
    expect(card.explanation).toBe('Czynność przed inną czynnością przeszłą.');
  });

  it('exports a deck whose name has Polish characters', async () => {
    // Regression guard: the filename goes into Content-Disposition, and a
    // raw "ł" there made Node throw, so every seeded deck ("Słownictwo",
    // "Czasy angielskie") answered 500 instead of a file.
    const agent = await registerAgent('csv-pl@example.com');
    const deckId = await createDeck(agent, 'Słownictwo — grupa 1 · żółć');
    await agent.post('/api/cards').set('Origin', TEST_ORIGIN).send({ deckId, word: 'yellow' });

    const res = await agent.get(`/api/decks/${deckId}/export`).query({ format: 'csv' });
    expect(res.status).toBe(200);

    const disposition = res.headers['content-disposition'];
    // An ASCII-safe name for old clients, plus the real UTF-8 one.
    expect(disposition).toMatch(/filename="[\x20-\x7E]*"/);
    expect(disposition).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1])).toContain('Słownictwo');
  });

  it('still accepts a legacy CSV without the type and level columns', async () => {
    const agent = await registerAgent('csv2@example.com');
    const deckId = await createDeck(agent);

    const legacy = 'word,translationPl\nabandon,porzucić\n';
    const res = await agent
      .post(`/api/decks/${deckId}/import`)
      .set('Origin', TEST_ORIGIN)
      .send({ format: 'csv', content: legacy });

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);

    const cards = await agent.get('/api/cards').query({ deckId });
    expect(cards.body.items[0].type).toBe('VOCABULARY');
    expect(cards.body.items[0].level).toBe('A1');
  });

  it('falls back to the defaults when a CSV carries an unknown type or level', async () => {
    const agent = await registerAgent('csv3@example.com');
    const deckId = await createDeck(agent);

    const res = await agent
      .post(`/api/decks/${deckId}/import`)
      .set('Origin', TEST_ORIGIN)
      .send({ format: 'csv', content: 'word,type,level\nmystery,IDIOMS,Z9\n' });

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);

    const cards = await agent.get('/api/cards').query({ deckId });
    expect(cards.body.items[0].type).toBe('VOCABULARY');
    expect(cards.body.items[0].level).toBe('A1');
  });
});
