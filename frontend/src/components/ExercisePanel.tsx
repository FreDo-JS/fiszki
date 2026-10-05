import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ChoiceExercise,
  EXERCISE_LABEL,
  Exercise,
  FillInExercise,
  OrderExercise,
  checkAnswer,
} from '../api/exercises';
import { Button, Input } from './ui';
import { Icon } from './Icon';

/**
 * Zadanie z fiszki w trzech wariantach: luka do wpisania, wybór z listy oraz
 * układanie zdania z rozsypanki. Komponent sam sprawdza odpowiedź i zgłasza
 * wynik przez onResult — decyzję, co z nim zrobić (ocena SM-2 albo zwykłe
 * ćwiczenie bez konsekwencji), podejmuje strona nadrzędna.
 */
export function ExercisePanel({
  exercises,
  onResult,
  resultLabel,
}: {
  exercises: Exercise[];
  onResult?: (correct: boolean, exercise: Exercise) => void;
  /** Komunikat pod zadaniem, np. informacja o zapisanej ocenie. */
  resultLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const exercise = exercises[index];

  if (!exercise) {
    return (
      <p className="rounded-xl bg-surface-subtle p-4 text-sm text-ink-muted">
        Ta fiszka nie ma jeszcze materiału na zadanie. Dodaj do niej przykład użycia albo tłumaczenie,
        a zadania wygenerują się automatycznie.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {exercises.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {exercises.map((ex, i) => (
            <button
              key={ex.kind}
              type="button"
              onClick={() => setIndex(i)}
              className={clsx(
                'min-h-touch rounded-full border px-3.5 text-sm font-medium transition-colors',
                i === index
                  ? 'border-secondary bg-secondary text-white'
                  : 'border-border bg-surface-raised text-ink-muted hover:text-ink'
              )}
            >
              {EXERCISE_LABEL[ex.kind]}
            </button>
          ))}
        </div>
      )}

      <ExerciseBody key={`${index}-${exercise.kind}`} exercise={exercise} onResult={onResult} resultLabel={resultLabel} />
    </div>
  );
}

function ExerciseBody({
  exercise,
  onResult,
  resultLabel,
}: {
  exercise: Exercise;
  onResult?: (correct: boolean, exercise: Exercise) => void;
  resultLabel?: string;
}) {
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [built, setBuilt] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);

  const remaining = useMemo(() => {
    if (exercise.kind !== 'ORDER') return [];
    // Rozsypanka minus to, co już ułożono — po jednym egzemplarzu tokenu,
    // bo zdanie może zawierać to samo słowo dwa razy.
    const left = [...exercise.tokens];
    built.forEach((token) => {
      const at = left.indexOf(token);
      if (at !== -1) left.splice(at, 1);
    });
    return left;
  }, [exercise, built]);

  const answer: string | string[] =
    exercise.kind === 'FILL_IN' ? text : exercise.kind === 'CHOICE' ? picked ?? '' : built;

  const canCheck =
    exercise.kind === 'FILL_IN' ? text.trim().length > 0 : exercise.kind === 'CHOICE' ? picked !== null : built.length > 0;

  const handleCheck = () => {
    if (!canCheck || checked) return;
    const ok = checkAnswer(exercise, answer);
    setCorrect(ok);
    setChecked(true);
    onResult?.(ok, exercise);
  };

  const handleRetry = () => {
    setChecked(false);
    setCorrect(false);
    setText('');
    setPicked(null);
    setBuilt([]);
    setShowHint(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {exercise.kind === 'FILL_IN' && (
        <FillInBody
          exercise={exercise}
          value={text}
          onChange={setText}
          disabled={checked}
          showHint={showHint}
          onHint={() => setShowHint(true)}
          onEnter={handleCheck}
        />
      )}

      {exercise.kind === 'CHOICE' && (
        <ChoiceBody exercise={exercise} picked={picked} onPick={setPicked} checked={checked} />
      )}

      {exercise.kind === 'ORDER' && (
        <OrderBody
          exercise={exercise}
          built={built}
          remaining={remaining}
          onChange={setBuilt}
          disabled={checked}
        />
      )}

      {!checked && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="teal" onClick={handleCheck} disabled={!canCheck}>
            Sprawdź
          </Button>
          {exercise.kind === 'ORDER' && built.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setBuilt([])}>
              Wyczyść
            </Button>
          )}
        </div>
      )}

      {checked && (
        <div
          className={clsx(
            'flex flex-col gap-2 rounded-xl p-3 text-sm animate-slide-up',
            correct ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          )}
        >
          <span className="flex items-center gap-2 font-medium">
            <Icon name={correct ? 'check' : 'cross'} className="h-4 w-4" />
            {correct ? 'Dobrze!' : 'Niepoprawnie'}
          </span>
          {!correct && (
            <span className="text-ink">
              Poprawna odpowiedź:{' '}
              <strong>
                {exercise.kind === 'FILL_IN'
                  ? exercise.answer
                  : exercise.kind === 'CHOICE'
                    ? exercise.options[exercise.answerIndex]
                    : exercise.answer.join(' ')}
              </strong>
            </span>
          )}
          {resultLabel && <span className="text-xs text-ink-muted">{resultLabel}</span>}
          {!onResult && (
            <Button size="sm" variant="secondary" onClick={handleRetry} className="self-start">
              Spróbuj ponownie
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FillInBody({
  exercise,
  value,
  onChange,
  disabled,
  showHint,
  onHint,
  onEnter,
}: {
  exercise: FillInExercise;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  showHint: boolean;
  onHint: () => void;
  onEnter: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-xl bg-surface-subtle p-3 text-base text-ink">{exercise.prompt}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
        }}
        disabled={disabled}
        placeholder="Wpisz brakujące słowo"
        aria-label="Brakujące słowo"
        autoComplete="off"
      />
      {showHint ? (
        <p className="text-xs text-ink-muted">Podpowiedź: {exercise.hint}</p>
      ) : (
        <button type="button" onClick={onHint} className="self-start text-xs text-accent hover:underline">
          Pokaż podpowiedź
        </button>
      )}
    </div>
  );
}

function ChoiceBody({
  exercise,
  picked,
  onPick,
  checked,
}: {
  exercise: ChoiceExercise;
  picked: string | null;
  onPick: (v: string) => void;
  checked: boolean;
}) {
  const correctOption = exercise.options[exercise.answerIndex];
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-xl bg-surface-subtle p-3 text-base text-ink">{exercise.prompt}</p>
      <div role="radiogroup" aria-label="Warianty odpowiedzi" className="grid gap-2 sm:grid-cols-2">
        {exercise.options.map((option) => {
          const isPicked = picked === option;
          const isCorrect = option === correctOption;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={checked}
              onClick={() => onPick(option)}
              className={clsx(
                'min-h-touch rounded-xl border px-3.5 py-2 text-left text-sm transition-colors',
                checked && isCorrect && 'border-success bg-success/10 text-success',
                checked && isPicked && !isCorrect && 'border-danger bg-danger/10 text-danger',
                !checked && isPicked && 'border-accent bg-accent-soft text-accent',
                !checked && !isPicked && 'border-border bg-surface-raised text-ink hover:border-accent/40'
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderBody({
  exercise,
  built,
  remaining,
  onChange,
  disabled,
}: {
  exercise: OrderExercise;
  built: string[];
  remaining: string[];
  onChange: (tokens: string[]) => void;
  disabled: boolean;
}) {
  // Obsługa i myszą (przeciąganie), i dotykiem (zwykłe kliknięcie) — natywne
  // drag and drop na telefonie praktycznie nie działa, więc klikanie jest tu
  // pełnoprawną drogą, a nie namiastką.
  const [dragged, setDragged] = useState<{ from: 'pool' | 'answer'; index: number } | null>(null);

  const addToken = (poolIndex: number) => {
    if (disabled) return;
    onChange([...built, remaining[poolIndex]]);
  };

  const removeToken = (answerIndex: number) => {
    if (disabled) return;
    onChange(built.filter((_, i) => i !== answerIndex));
  };

  const dropOnAnswer = (targetIndex: number) => {
    if (disabled || !dragged) return;
    if (dragged.from === 'pool') {
      const next = [...built];
      next.splice(targetIndex, 0, remaining[dragged.index]);
      onChange(next);
    } else {
      const next = [...built];
      const [moved] = next.splice(dragged.index, 1);
      next.splice(dragged.index < targetIndex ? targetIndex - 1 : targetIndex, 0, moved);
      onChange(next);
    }
    setDragged(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{exercise.prompt}</p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dropOnAnswer(built.length)}
        className={clsx(
          'flex min-h-[3.5rem] flex-wrap content-start items-start gap-2 rounded-xl border-2 border-dashed p-2.5 transition-colors',
          built.length === 0 ? 'border-border' : 'border-secondary/40 bg-secondary-soft/30'
        )}
        aria-label="Twoja odpowiedź"
      >
        {built.length === 0 && (
          <span className="self-center text-xs text-ink-faint">Kliknij słowa poniżej albo przeciągnij je tutaj</span>
        )}
        {built.map((token, i) => (
          <button
            key={`${token}-${i}`}
            type="button"
            draggable={!disabled}
            onDragStart={() => setDragged({ from: 'answer', index: i })}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation();
              dropOnAnswer(i);
            }}
            onClick={() => removeToken(i)}
            disabled={disabled}
            title="Kliknij, aby usunąć"
            className="min-h-touch cursor-grab rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-white active:cursor-grabbing disabled:cursor-default"
          >
            {token}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Rozsypanka">
        {remaining.map((token, i) => (
          <button
            key={`${token}-${i}`}
            type="button"
            draggable={!disabled}
            onDragStart={() => setDragged({ from: 'pool', index: i })}
            onClick={() => addToken(i)}
            disabled={disabled}
            className="min-h-touch cursor-grab rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink transition-colors hover:border-secondary active:cursor-grabbing disabled:cursor-default"
          >
            {token}
          </button>
        ))}
        {remaining.length === 0 && <span className="text-xs text-ink-faint">Wszystkie słowa użyte</span>}
      </div>
    </div>
  );
}

/** Pobiera zadania dla fiszki i renderuje panel, obsługując stany pośrednie. */
export function ExerciseLoader({
  load,
  onResult,
  resultLabel,
}: {
  load: () => Promise<Exercise[]>;
  onResult?: (correct: boolean, exercise: Exercise) => void;
  resultLabel?: string;
}) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((list) => alive && setExercises(list))
      .catch(() => alive && setError('Nie udało się wczytać zadania.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!exercises) return <p className="text-sm text-ink-faint">Przygotowuję zadanie…</p>;
  return <ExercisePanel exercises={exercises} onResult={onResult} resultLabel={resultLabel} />;
}
