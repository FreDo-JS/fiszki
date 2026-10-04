import { api } from './client';
import { Card, CardLevel, CardType, Rating, StudyMode } from './types';

export interface DueQueueOptions {
  limit?: number;
  /** 'review' = only cards the scheduler brought back, 'new' = never studied. */
  mode?: StudyMode;
  type?: CardType;
  level?: CardLevel;
}

export async function getDueQueue(deckId: string, options: DueQueueOptions = {}) {
  const { limit = 20, mode, type, level } = options;
  const { data } = await api.get<{ total: number; newAllowance: number; cards: Card[] }>(`/study/${deckId}`, {
    params: { limit, mode, type, level },
  });
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

/** Reverses the most recent grading and returns the card as it was before. */
export async function undoLastReview() {
  const { data } = await api.post<{ card: Card; undoneRating: Rating }>('/reviews/undo');
  return data;
}
