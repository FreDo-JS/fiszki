import { api } from './client';
import { Deck } from './types';

export async function listDecks(params?: { search?: string; tag?: string }) {
  const { data } = await api.get<{ decks: Deck[] }>('/decks', { params });
  return data.decks;
}

export async function getDeck(id: string) {
  const { data } = await api.get<{ deck: Deck }>(`/decks/${id}`);
  return data.deck;
}

export async function createDeck(input: { name: string; description?: string; color?: string; icon?: string; isPublic?: boolean }) {
  const { data } = await api.post<{ deck: Deck }>('/decks', input);
  return data.deck;
}

export async function updateDeck(id: string, input: Partial<{ name: string; description: string; color: string; icon: string; isPublic: boolean }>) {
  const { data } = await api.put<{ deck: Deck }>(`/decks/${id}`, input);
  return data.deck;
}

export async function deleteDeck(id: string) {
  await api.delete(`/decks/${id}`);
}

export async function duplicateDeck(id: string) {
  const { data } = await api.post<{ deck: Deck }>(`/decks/${id}/duplicate`);
  return data.deck;
}

export async function importCards(id: string, format: 'csv' | 'json', content: string) {
  const { data } = await api.post<{ imported: number; skipped: number; errors: string[] }>(`/decks/${id}/import`, {
    format,
    content,
  });
  return data;
}

export function exportDeckUrl(id: string, format: 'csv' | 'json') {
  return `${api.defaults.baseURL}/decks/${id}/export?format=${format}`;
}

export async function exportCards(id: string, format: 'csv' | 'json') {
  const { data } = await api.get<string>(`/decks/${id}/export`, { params: { format }, responseType: 'text' });
  return data;
}
