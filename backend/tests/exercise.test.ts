import { describe, expect, it } from 'vitest';
import {
  ChoiceExercise,
  Exercise,
  ExerciseSourceCard,
  FillInExercise,
  OrderExercise,
  generateExercises,
  isCorrectAnswer,
  normalizeAnswer,
} from '../src/services/exercise.service';

// Deterministyczny generator pseudolosowy — tasowanie musi być powtarzalne,
// inaczej test raz przechodzi, raz nie.
function seededRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function card(partial: Partial<ExerciseSourceCard> & { id: string }): ExerciseSourceCard {
  return {
    word: 'word',
    meaningEn: null,
    translationPl: null,
    exampleSentence: null,
    type: 'GRAMMAR',
    level: 'A1',
    ...partial,
  };
}

function pool(count: number): ExerciseSourceCard[] {
  return Array.from({ length: count }, (_, i) =>
    card({
      id: `pool-${i}`,
      word: `alpha${i}`,
      translationPl: `tłumaczenie ${i}`,
      exampleSentence: `This is distractor${i} in a sentence.`,
    })
  );
}

const find = <T extends Exercise>(list: Exercise[], kind: T['kind']): T | undefined =>
  list.find((e) => e.kind === kind) as T | undefined;

describe('normalizeAnswer', () => {
  it('ignores case and surrounding punctuation', () => {
    expect(normalizeAnswer('  Works.  ')).toBe('works');
    expect(normalizeAnswer('"office,"')).toBe('office');
    expect(normalizeAnswer('ŻÓŁĆ')).toBe('żółć');
  });
});

describe('generateExercises', () => {
  it('builds a fill-in task that hides the card word in the example', () => {
    const exercises = generateExercises(
      card({ id: 'c1', word: 'office', exampleSentence: 'She works in an office.' }),
      [],
      seededRng(1)
    );

    const fill = find<FillInExercise>(exercises, 'FILL_IN');
    expect(fill).toBeDefined();
    expect(fill!.prompt).toBe('She works in an ___');
    expect(fill!.answer).toBe('office');
  });

  it('finds the card word even in an inflected form', () => {
    const exercises = generateExercises(
      card({ id: 'c2', word: 'to work', exampleSentence: 'She worked all evening.' }),
      [],
      seededRng(2)
    );

    const fill = find<FillInExercise>(exercises, 'FILL_IN');
    expect(fill!.answer).toBe('worked');
    expect(fill!.prompt).toContain('___');
  });

  it('gives a hint that reveals the first letter and the length, not the word', () => {
    const exercises = generateExercises(
      card({ id: 'c3', word: 'office', exampleSentence: 'She works in an office.' }),
      [],
      seededRng(3)
    );

    const fill = find<FillInExercise>(exercises, 'FILL_IN')!;
    expect(fill.hint.startsWith('o')).toBe(true);
    expect(fill.hint).not.toContain('office');
    expect(fill.hint).toContain('6');
  });

  it('builds a multiple choice task with exactly four distinct options', () => {
    const exercises = generateExercises(
      card({ id: 'c4', word: 'office', exampleSentence: 'She works in an office.' }),
      pool(6),
      seededRng(4)
    );

    const choice = find<ChoiceExercise>(exercises, 'CHOICE');
    expect(choice).toBeDefined();
    expect(choice!.options).toHaveLength(4);
    expect(new Set(choice!.options).size).toBe(4);
    expect(choice!.options[choice!.answerIndex]).toBe('office');
  });

  it('skips the choice task when there are too few distractors', () => {
    const exercises = generateExercises(
      card({ id: 'c5', word: 'office', exampleSentence: 'She works in an office.' }),
      pool(2),
      seededRng(5)
    );

    expect(find(exercises, 'CHOICE')).toBeUndefined();
  });

  it('falls back to translations when the card has no example sentence', () => {
    const exercises = generateExercises(
      card({ id: 'c6', word: 'opportunity', translationPl: 'okazja' }),
      pool(5),
      seededRng(6)
    );

    const choice = find<ChoiceExercise>(exercises, 'CHOICE');
    expect(choice).toBeDefined();
    expect(choice!.prompt).toBe('opportunity');
    expect(choice!.options[choice!.answerIndex]).toBe('okazja');
    // Bez przykładu nie ma czego układać ani w czym robić luki.
    expect(find(exercises, 'FILL_IN')).toBeUndefined();
    expect(find(exercises, 'ORDER')).toBeUndefined();
  });

  it('builds a word-order task whose tokens are a true shuffle of the sentence', () => {
    const exercises = generateExercises(
      card({
        id: 'c7',
        word: 'Present Perfect',
        translationPl: 'Właśnie skończyłem pracę',
        exampleSentence: 'I have finished my work.',
      }),
      [],
      seededRng(7)
    );

    const order = find<OrderExercise>(exercises, 'ORDER');
    expect(order).toBeDefined();
    expect(order!.answer).toEqual(['I', 'have', 'finished', 'my', 'work.']);
    expect([...order!.tokens].sort()).toEqual([...order!.answer].sort());
    // Rozsypanka nie może być od razu poprawną odpowiedzią.
    expect(order!.tokens.join(' ')).not.toBe(order!.answer.join(' '));
  });

  it('hides every occurrence of the answer, not just the first', () => {
    // Strażnik regresji: przykłady gramatyczne bywają dwuczłonowe, a zasłonięcie
    // jednego wystąpienia zostawiało odpowiedź wprost w treści zadania.
    const exercises = generateExercises(
      card({
        id: 'c-dup',
        word: 'tired',
        exampleSentence: '"I am tired," she said. She said she was tired.',
      }),
      [],
      seededRng(20)
    );

    const fill = find<FillInExercise>(exercises, 'FILL_IN')!;
    expect(fill.answer).toBe('tired');
    expect(fill.prompt.toLowerCase()).not.toContain('tired');
    expect(fill.prompt.match(/___/g)).toHaveLength(2);
  });

  it('does not turn a list of forms into a word-order puzzle', () => {
    // "bus - buses, box - boxes" nie ma jednej poprawnej kolejności.
    const exercises = generateExercises(
      card({ id: 'c-list', word: 'plural', exampleSentence: 'bus - buses, box - boxes, city - cities' }),
      [],
      seededRng(21)
    );
    expect(find(exercises, 'ORDER')).toBeUndefined();
  });

  it('keeps the word-order instruction neutral instead of quoting an unrelated translation', () => {
    const exercises = generateExercises(
      card({
        id: 'c-prompt',
        word: 'Mowa zależna',
        translationPl: 'teraźniejszy - przeszły, przeszły - zaprzeszły',
        exampleSentence: 'She said she was tired yesterday.',
      }),
      [],
      seededRng(22)
    );

    const order = find<OrderExercise>(exercises, 'ORDER')!;
    expect(order.prompt).toBe('Ułóż poprawne zdanie z rozsypanki');
    expect(order.prompt).not.toContain('zaprzeszły');
  });

  it('skips the word-order task for sentences too short to be a puzzle', () => {
    const exercises = generateExercises(
      card({ id: 'c8', word: 'go', exampleSentence: 'I go.' }),
      [],
      seededRng(8)
    );
    expect(find(exercises, 'ORDER')).toBeUndefined();
  });

  it('returns nothing for a card with no example and no translation', () => {
    expect(generateExercises(card({ id: 'c9', word: 'bare' }), pool(5), seededRng(9))).toEqual([]);
  });

  it('produces all three kinds for a well-filled grammar card', () => {
    const exercises = generateExercises(
      card({
        id: 'c10',
        word: 'First Conditional',
        translationPl: 'Jeśli będzie padać, zostanę w domu',
        exampleSentence: 'If it rains, I will stay home.',
      }),
      pool(6),
      seededRng(10)
    );

    expect(exercises.map((e) => e.kind).sort()).toEqual(['CHOICE', 'FILL_IN', 'ORDER']);
  });
});

describe('isCorrectAnswer', () => {
  const exercises = generateExercises(
    card({ id: 'x', word: 'office', translationPl: 'biuro', exampleSentence: 'She works in an office.' }),
    pool(6),
    seededRng(11)
  );

  it('accepts a fill-in answer regardless of case and spacing', () => {
    const fill = find<FillInExercise>(exercises, 'FILL_IN')!;
    expect(isCorrectAnswer(fill, '  OFFICE ')).toBe(true);
    expect(isCorrectAnswer(fill, 'office.')).toBe(true);
    expect(isCorrectAnswer(fill, 'desk')).toBe(false);
  });

  it('checks the chosen option by its text, not its position', () => {
    const choice = find<ChoiceExercise>(exercises, 'CHOICE')!;
    expect(isCorrectAnswer(choice, choice.options[choice.answerIndex])).toBe(true);
    const wrong = choice.options.find((_, i) => i !== choice.answerIndex)!;
    expect(isCorrectAnswer(choice, wrong)).toBe(false);
  });

  it('requires the exact word order', () => {
    const order = generateExercises(
      card({ id: 'o', word: 'x', exampleSentence: 'I have finished my work.' }),
      [],
      seededRng(12)
    ).find((e) => e.kind === 'ORDER') as OrderExercise;

    expect(isCorrectAnswer(order, order.answer)).toBe(true);
    expect(isCorrectAnswer(order, [...order.answer].reverse())).toBe(false);
    // Przyjmujemy też odpowiedź sklejoną w tekst.
    expect(isCorrectAnswer(order, order.answer.join(' '))).toBe(true);
  });
});
