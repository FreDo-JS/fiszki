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

describe('Authorization / IDOR protection', () => {
  it('blocks user B from reading a private deck owned by user A', async () => {
    const alice = await registerAgent('alice@example.com');
    const bob = await registerAgent('bob@example.com');

    const deckRes = await alice.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: "Alice's private deck" });
    const deckId = deckRes.body.deck.id;

    const res = await bob.get(`/api/decks/${deckId}`);
    expect(res.status).toBe(403);
  });

  it("blocks user B from editing or deleting user A's card", async () => {
    const alice = await registerAgent('alice2@example.com');
    const bob = await registerAgent('bob2@example.com');

    const deckRes = await alice.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Deck' });
    const cardRes = await alice
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId: deckRes.body.deck.id, word: 'secretword' });
    const cardId = cardRes.body.card.id;

    const editAttempt = await bob.put(`/api/cards/${cardId}`).set('Origin', TEST_ORIGIN).send({ word: 'hacked' });
    expect(editAttempt.status).toBe(403);

    const deleteAttempt = await bob.delete(`/api/cards/${cardId}`).set('Origin', TEST_ORIGIN);
    expect(deleteAttempt.status).toBe(403);
  });

  it("blocks user B from submitting reviews against user A's card, preventing SRS-state tampering", async () => {
    const alice = await registerAgent('alice3@example.com');
    const bob = await registerAgent('bob3@example.com');

    const deckRes = await alice.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Deck' });
    const cardRes = await alice
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId: deckRes.body.deck.id, word: 'word' });

    const res = await bob
      .post('/api/reviews')
      .set('Origin', TEST_ORIGIN)
      .send({ cardId: cardRes.body.card.id, rating: 'GOOD' });
    expect(res.status).toBe(403);
  });

  it("cannot see another user's decks in the deck listing", async () => {
    const alice = await registerAgent('alice4@example.com');
    const bob = await registerAgent('bob4@example.com');

    await alice.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Alice deck' });
    const res = await bob.get('/api/decks');
    expect(res.status).toBe(200);
    expect(res.body.decks.find((d: { name: string }) => d.name === 'Alice deck')).toBeUndefined();
  });

  it('rejects non-admins attempting to access admin endpoints', async () => {
    const user = await registerAgent('regular@example.com');
    const res = await user.get('/api/admin/dashboard');
    expect(res.status).toBe(403);
  });
});

describe('Input sanitization', () => {
  it('strips script tags from card content to prevent stored XSS', async () => {
    const agent = await registerAgent('xss@example.com');
    const deckRes = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Deck' });

    const res = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({
        deckId: deckRes.body.deck.id,
        word: '<script>alert(1)</script>hack',
        exampleSentence: '<img src=x onerror=alert(1)>Example',
      });

    expect(res.status).toBe(201);
    expect(res.body.card.word).not.toContain('<script>');
    expect(res.body.card.exampleSentence).not.toContain('onerror');
  });

  it('treats a SQL-injection-style search string as a literal, harmless value', async () => {
    const agent = await registerAgent('sqli@example.com');
    const deckRes = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Deck' });
    await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId: deckRes.body.deck.id, word: 'legit' });

    const res = await agent.get('/api/cards').query({ search: "'; DROP TABLE \"Card\"; --" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    // Prove the table is still very much alive.
    const stillThere = await agent.get('/api/cards').query({ search: 'legit' });
    expect(stillThere.body.items.length).toBe(1);
  });

  it('ignores client-supplied SRS fields on card creation (mass assignment)', async () => {
    const agent = await registerAgent('mass@example.com');
    const deckRes = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Deck' });

    const res = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId: deckRes.body.deck.id, word: 'cheat', mastered: true, repetitions: 999, easeFactor: 99 });

    expect(res.status).toBe(201);
    expect(res.body.card.mastered).toBe(false);
    expect(res.body.card.repetitions).toBe(0);
    expect(res.body.card.easeFactor).toBe(2.5);
  });

  it('never allows a regular user to publish a public deck via isPublic in the request body', async () => {
    const agent = await registerAgent('nopublic@example.com');
    const res = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Sneaky deck', isPublic: true });
    expect(res.status).toBe(201);
    expect(res.body.deck.isPublic).toBe(false);
  });
});
