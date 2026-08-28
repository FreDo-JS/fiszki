import { api } from './client';
import { Card, PaginatedResult } from './types';

export interface CardInput {
  deckId?: string;
  word: string;
  meaningEn?: string;
  translationPl?: string;
  exampleSentence?: string;
  pronunciationIpa?: string;
  partOfSpeech?: string;
  tags?: string[];
}

export async function listCards(params: { deckId?: string; search?: string; tag?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get<PaginatedResult<Card>>('/cards', { params });
  return data;
}

export async function getCard(id: string) {
  const { data } = await api.get<{ card: Card }>(`/cards/${id}`);
  return data.card;
}

export async function createCard(input: CardInput) {
  const { data } = await api.post<{ card: Card }>('/cards', input);
  return data.card;
}

export async function updateCard(id: string, input: Partial<CardInput>) {
  const { data } = await api.put<{ card: Card }>(`/cards/${id}`, input);
  return data.card;
}

export async function deleteCard(id: string) {
  await api.delete(`/cards/${id}`);
}

export async function listTags() {
  const { data } = await api.get<{ tags: { id: string; name: string }[] }>('/cards/tags');
  return data.tags;
}

export async function generateFields(word: string) {
  const { data } = await api.post<{ fields: { meaningEn: string | null; exampleSentence: string | null; pronunciationIpa: string | null; partOfSpeech: string | null } }>(
    '/cards/generate',
    { word }
  );
  return data.fields;
}
