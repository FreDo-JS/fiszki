import { api } from './client';

export type ExerciseKind = 'FILL_IN' | 'CHOICE' | 'ORDER';

export interface FillInExercise {
  kind: 'FILL_IN';
  /** Zdanie z luką zapisaną jako ___ */
  prompt: string;
  answer: string;
  hint: string;
}

export interface ChoiceExercise {
  kind: 'CHOICE';
  prompt: string;
  options: string[];
  answerIndex: number;
}

export interface OrderExercise {
  kind: 'ORDER';
  prompt: string;
  tokens: string[];
  answer: string[];
}

export type Exercise = FillInExercise | ChoiceExercise | OrderExercise;

export const EXERCISE_LABEL: Record<ExerciseKind, string> = {
  FILL_IN: 'Wpisz',
  CHOICE: 'Wybierz',
  ORDER: 'Ułóż',
};

/**
 * Zadania budowane są na serwerze z treści samej fiszki, więc lista bywa
 * pusta — fiszka bez przykładu i bez tłumaczenia nie daje materiału.
 */
export async function getExercises(cardId: string) {
  const { data } = await api.get<{ exercises: Exercise[] }>(`/cards/${cardId}/exercises`);
  return data.exercises;
}

/** Porównanie odporne na wielkość liter i interpunkcję — jak na serwerze. */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function checkAnswer(exercise: Exercise, answer: string | string[]): boolean {
  switch (exercise.kind) {
    case 'FILL_IN':
      return typeof answer === 'string' && normalizeAnswer(answer) === normalizeAnswer(exercise.answer);
    case 'CHOICE': {
      const picked = typeof answer === 'string' ? answer : answer[0];
      return normalizeAnswer(picked ?? '') === normalizeAnswer(exercise.options[exercise.answerIndex]);
    }
    case 'ORDER': {
      const given = Array.isArray(answer) ? answer : answer.split(/\s+/);
      return given.join(' ') === exercise.answer.join(' ');
    }
  }
}
