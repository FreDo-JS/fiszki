// Generator zadań ćwiczeniowych budowanych z treści fiszki — bez osobnej bazy
// zadań i bez pisania ich ręcznie. Każda fiszka z przykładem użycia dostaje
// komplet wariantów, a te bez przykładu przynajmniej wariant wyboru.
//
// Moduł jest czysty: dostaje fiszkę i pulę fiszek na dystraktory, zwraca
// gotowe zadania. Nie dotyka bazy ani cyklu żądania, więc da się go testować
// w oderwaniu od reszty i używać zarówno w sesji nauki, jak i na liście fiszek.

export type ExerciseKind = 'FILL_IN' | 'CHOICE' | 'ORDER';

export interface FillInExercise {
  kind: 'FILL_IN';
  /** Zdanie z luką oznaczoną jako ___ */
  prompt: string;
  answer: string;
  /** Podpowiedź pokazywana na życzenie: pierwsza litera i długość. */
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
  /** Rozsypanka do ułożenia. */
  tokens: string[];
  answer: string[];
}

export type Exercise = FillInExercise | ChoiceExercise | OrderExercise;

export interface ExerciseSourceCard {
  id: string;
  word: string;
  meaningEn: string | null;
  translationPl: string | null;
  exampleSentence: string | null;
  type: string;
  level: string;
}

/** Minimalna liczba słów, poniżej której układanie zdania nie jest ćwiczeniem. */
const MIN_ORDER_TOKENS = 4;
const MAX_ORDER_TOKENS = 14;
const CHOICE_OPTIONS = 4;

export type Rng = () => number;

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Porównanie odporne na wielkość liter i interpunkcję przy krawędziach. */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function tokenize(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/**
 * Wybiera słowo do ukrycia. Dla fiszki słownikowej to samo słówko (również
 * w formie odmienionej, stąd dopasowanie po rdzeniu), a dla gramatyki
 * i czasów — najdłuższe sensowne słowo, bo zwykle niesie badaną konstrukcję.
 */
function pickBlankToken(tokens: string[], word: string): number {
  const base = normalizeAnswer(word.replace(/^to\s+/i, ''));

  if (base.length > 2) {
    const exact = tokens.findIndex((t) => normalizeAnswer(t) === base);
    if (exact !== -1) return exact;

    const stem = base.slice(0, Math.max(3, base.length - 2));
    const inflected = tokens.findIndex((t) => normalizeAnswer(t).startsWith(stem));
    if (inflected !== -1) return inflected;
  }

  let best = -1;
  let bestLength = 0;
  tokens.forEach((token, i) => {
    const len = normalizeAnswer(token).length;
    if (len > bestLength) {
      bestLength = len;
      best = i;
    }
  });
  return bestLength >= 3 ? best : -1;
}

/**
 * Ukrywa wszystkie wystąpienia szukanego słowa, nie tylko wskazane. Przykłady
 * gramatyczne bywają dwuczłonowe ("I am tired," she said. - She said she was
 * tired.) i zasłonięcie jednego wystąpienia zostawiałoby odpowiedź wprost
 * w treści zadania.
 */
function buildPromptWithBlank(tokens: string[], index: number): string {
  const target = normalizeAnswer(tokens[index]);
  return tokens
    .map((token, i) => {
      if (i === index) return '___';
      return normalizeAnswer(token) === target ? '___' : token;
    })
    .join(' ');
}

function hintFor(answer: string): string {
  const clean = normalizeAnswer(answer);
  if (clean.length <= 1) return clean;
  return `${clean[0]}${'·'.repeat(clean.length - 1)} (${clean.length} liter)`;
}

function buildFillIn(card: ExerciseSourceCard): FillInExercise | null {
  if (!card.exampleSentence) return null;
  const tokens = tokenize(card.exampleSentence);
  if (tokens.length < 3) return null;

  const index = pickBlankToken(tokens, card.word);
  if (index === -1) return null;

  const answer = normalizeAnswer(tokens[index]);
  if (!answer) return null;

  return {
    kind: 'FILL_IN',
    prompt: buildPromptWithBlank(tokens, index),
    answer,
    hint: hintFor(answer),
  };
}

function buildChoice(card: ExerciseSourceCard, pool: ExerciseSourceCard[], rng: Rng): ChoiceExercise | null {
  // Z przykładem pytamy o słowo w luce, bez przykładu — o tłumaczenie.
  let prompt: string;
  let correct: string;
  let distractorsSource: string[];

  if (card.exampleSentence) {
    const tokens = tokenize(card.exampleSentence);
    const index = pickBlankToken(tokens, card.word);
    if (index === -1) return null;
    prompt = buildPromptWithBlank(tokens, index);
    correct = normalizeAnswer(tokens[index]);
    distractorsSource = pool
      .filter((c) => c.id !== card.id && c.exampleSentence)
      .map((c) => {
        const t = tokenize(c.exampleSentence as string);
        const i = pickBlankToken(t, c.word);
        return i === -1 ? '' : normalizeAnswer(t[i]);
      });
  } else if (card.translationPl) {
    prompt = card.word;
    correct = card.translationPl.trim();
    distractorsSource = pool.filter((c) => c.id !== card.id).map((c) => (c.translationPl ?? '').trim());
  } else {
    return null;
  }

  if (!correct) return null;

  const distractors = [...new Set(distractorsSource.filter((d) => d && normalizeAnswer(d) !== normalizeAnswer(correct)))];
  // Trzy błędne odpowiedzi to minimum, żeby wybór nie był zgadywanką 50/50.
  if (distractors.length < CHOICE_OPTIONS - 1) return null;

  const chosen = shuffle(distractors, rng).slice(0, CHOICE_OPTIONS - 1);
  const options = shuffle([correct, ...chosen], rng);

  return {
    kind: 'CHOICE',
    prompt,
    options,
    answerIndex: options.indexOf(correct),
  };
}

/**
 * Czy przykład jest pojedynczym zdaniem. Fiszki gramatyczne często zawierają
 * zestawienia ("bus - buses, box - boxes") albo parę wariantów rozdzielonych
 * ukośnikiem — układanie ich z rozsypanki nie ma jednej poprawnej odpowiedzi.
 */
function isSingleSentence(sentence: string): boolean {
  return !/\s[-–—/]\s/.test(sentence);
}

function buildOrder(card: ExerciseSourceCard, rng: Rng): OrderExercise | null {
  if (!card.exampleSentence || !isSingleSentence(card.exampleSentence)) return null;
  const tokens = tokenize(card.exampleSentence);
  if (tokens.length < MIN_ORDER_TOKENS || tokens.length > MAX_ORDER_TOKENS) return null;

  // Przy krótkim zdaniu losowa kolejność bywa tożsama z poprawną — wtedy
  // zadanie nie miałoby sensu, więc tasujemy do skutku (z limitem prób).
  let shuffled = shuffle(tokens, rng);
  for (let attempt = 0; attempt < 5 && shuffled.join(' ') === tokens.join(' '); attempt++) {
    shuffled = shuffle(tokens, rng);
  }
  if (shuffled.join(' ') === tokens.join(' ')) return null;

  return {
    kind: 'ORDER',
    // Celowo bez tłumaczenia w poleceniu: przy fiszce gramatycznej pole
    // translationPl opisuje regułę ("teraźniejszy - przeszły"), a przy
    // słownikowej tłumaczy samo słowo — w obu przypadkach nie jest to
    // tłumaczenie tego zdania i jako polecenie wprowadzałoby w błąd.
    prompt: 'Ułóż poprawne zdanie z rozsypanki',
    tokens: shuffled,
    answer: tokens,
  };
}

/**
 * Zestaw zadań dla jednej fiszki. Zwraca tylko te warianty, które da się
 * zbudować z posiadanych danych — lista bywa pusta i to jest poprawny wynik
 * (np. fiszka bez przykładu i bez tłumaczenia).
 */
export function generateExercises(
  card: ExerciseSourceCard,
  pool: ExerciseSourceCard[] = [],
  rng: Rng = Math.random
): Exercise[] {
  const exercises: Exercise[] = [];

  const fillIn = buildFillIn(card);
  if (fillIn) exercises.push(fillIn);

  const choice = buildChoice(card, pool, rng);
  if (choice) exercises.push(choice);

  const order = buildOrder(card, rng);
  if (order) exercises.push(order);

  return exercises;
}

/** Sprawdzenie odpowiedzi po stronie serwera — używane też przez testy. */
export function isCorrectAnswer(exercise: Exercise, answer: string | string[]): boolean {
  switch (exercise.kind) {
    case 'FILL_IN':
      return typeof answer === 'string' && normalizeAnswer(answer) === normalizeAnswer(exercise.answer);
    case 'CHOICE': {
      const picked = typeof answer === 'string' ? answer : answer[0];
      return normalizeAnswer(picked ?? '') === normalizeAnswer(exercise.options[exercise.answerIndex]);
    }
    case 'ORDER': {
      const given = Array.isArray(answer) ? answer : tokenize(answer);
      return given.join(' ') === exercise.answer.join(' ');
    }
  }
}
