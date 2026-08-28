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

describe('Deck & card CRUD', () => {
  it('creates a deck and a card within it, defaulting to a fresh SRS state', async () => {
    const agent = await registerAgent('owner@example.com');

    const deckRes = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'English A1' });
    expect(deckRes.status).toBe(201);
    const deckId = deckRes.body.deck.id;

    const cardRes = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId, word: 'abandon', translationPl: 'porzucić', tags: ['b1', 'verbs'] });

    expect(cardRes.status).toBe(201);
    expect(cardRes.body.card.word).toBe('abandon');
    expect(cardRes.body.card.repetitions).toBe(0);
    expect(cardRes.body.card.mastered).toBe(false);
    expect(cardRes.body.card.tags).toEqual(expect.arrayContaining(['b1', 'verbs']));
  });

  it('rejects a card creation request missing the required word field', async () => {
    const agent = await registerAgent('owner2@example.com');
    const deckRes = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Deck' });
    const res = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId: deckRes.body.deck.id, word: '' });
    expect(res.status).toBe(400);
  });

  it('deletes a card the user owns', async () => {
    const agent = await registerAgent('owner3@example.com');
    const deckRes = await agent.post('/api/decks').set('Origin', TEST_ORIGIN).send({ name: 'Deck' });
    const cardRes = await agent
      .post('/api/cards')
      .set('Origin', TEST_ORIGIN)
      .send({ deckId: deckRes.body.deck.id, word: 'leave' });

    const del = await agent.delete(`/api/cards/${cardRes.body.card.id}`).set('Origin', TEST_ORIGIN);
    expect(del.status).toBe(204);

    const get = await agent.get(`/api/cards/${cardRes.body.card.id}`);
    expect(get.status).toBe(404);
  });
});
