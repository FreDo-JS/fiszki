import { api } from './client';
import { Card, Rating } from './types';

export async function getDueQueue(deckId: string, limit = 20) {
  const { data } = await api.get<{ total: number; cards: Card[] }>(`/study/${deckId}`, { params: { limit } });
  return data;
}

export async function startSession(deckId: string) {
  const { data } = await api.post<{ session: { id: string } }>('/study/session', { deckId });
  return data.session;
}

export async function endSession(id: string) {
  await api.patch(`/study/session/${id}/end`);
}

export async function submitReview(input: { cardId: string; rating: Rating; responseTimeMs?: number; sessionId?: string }) {
  const { data } = await api.post<{ card: Card }>('/reviews', input);
  return data.card;
}
