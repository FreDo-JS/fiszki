import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as studyApi from '../api/study';
import * as decksApi from '../api/decks';
import { Card as CardType, Rating, StudyMode } from '../api/types';
import { Badge, Button, Card, ProgressBar, Spinner } from '../components/ui';
import { RatingButtons } from '../components/RatingButtons';
import { AudioButton } from '../components/AudioButton';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import { CARD_TYPE_LABEL, CARD_TYPE_TONE, RATINGS, STUDY_MODE_LABEL, isPassingRating } from '../utils/cards';

interface SessionStats {
  correct: number;
  incorrect: number;
  startedAt: number;
}

const SESSION_SIZE = 20;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function StudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // The dashboard links here with ?mode=review / ?mode=new; anything else
  // falls back to the mixed queue.
  const modeParam = searchParams.get('mode');
  const mode: StudyMode = modeParam === 'review' || modeParam === 'new' ? modeParam : 'mixed';

  const [deckName, setDeckName] = useState('');
  const [queue, setQueue] = useState<CardType[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ correct: 0, incorrect: 0, startedAt: Date.now() });
  const [elapsed, setElapsed] = useState(0);
  const shownAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!deckId) return;
    let alive = true;
    (async () => {
      try {
        const [deck, session, due] = await Promise.all([
          decksApi.getDeck(deckId),
          studyApi.startSession(deckId),
          studyApi.getDueQueue(deckId, { limit: SESSION_SIZE, mode }),
        ]);
        if (!alive) return;
        setDeckName(deck.name);
        setSessionId(session.id);
        setQueue(due.cards);
        setSessionTotal(due.cards.length);
        setStats({ correct: 0, incorrect: 0, startedAt: Date.now() });
        shownAtRef.current = Date.now();
        if (due.cards.length === 0) {
          // Close out the session we just opened instead of leaving it
          // dangling with no endedAt — sessionId state isn't committed yet
          // at this point in the closure, so use the local variable.
          await studyApi.endSession(session.id).catch(() => undefined);
          setFinished(true);
        }
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
        navigate(`/decks/${deckId}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, mode]);

  // Session clock, ticking only while cards are left to grade.
  useEffect(() => {
    if (loading || finished) return;
    const id = window.setInterval(() => setElapsed(Date.now() - stats.startedAt), 1000);
    return () => window.clearInterval(id);
  }, [loading, finished, stats.startedAt]);

  const currentCard = queue[index];
  const nextCard = queue[index + 1];

  const finishSession = useCallback(async () => {
    if (sessionId) {
      try {
        await studyApi.endSession(sessionId);
      } catch {
        // best-effort; the session row is a soft aggregate, not the source of truth
      }
    }
    setFinished(true);
  }, [sessionId]);

  const handleReveal = useCallback(() => {
    if (!currentCard) return;
    setRevealed(true);
  }, [currentCard]);

  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!currentCard || submitting || !revealed) return;
      setSubmitting(true);
      const responseTimeMs = Date.now() - shownAtRef.current;
      const passed = isPassingRating(rating);
      try {
        await studyApi.submitReview({ cardId: currentCard.id, rating, responseTimeMs, sessionId: sessionId ?? undefined });
        setStats((s) => (passed ? { ...s, correct: s.correct + 1 } : { ...s, incorrect: s.incorrect + 1 }));

        setQueue((prevQueue) => {
          const next = [...prevQueue];
          if (!passed) {
            // A failed card (AGAIN or HARD, i.e. SM-2 quality below 3) comes
            // back a little later in the same session instead of tomorrow, so
            // the user actually re-practises what they missed.
            const reinsertAt = Math.min(next.length, index + 3);
            const [card] = next.splice(index, 1);
            next.splice(reinsertAt, 0, card);
          } else {
            next.splice(index, 1);
          }
          return next;
        });

        setRevealed(false);
        shownAtRef.current = Date.now();
        // `index` stays at 0 for the whole session: splicing the current
        // card out (or, for a lapse, back in further down the array) always
        // shifts the next card down into slot 0, so we never advance it.
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [currentCard, submitting, revealed, sessionId, index, showToast]
  );

  useEffect(() => {
    if (!loading && queue.length === 0 && !finished) {
      finishSession();
    }
  }, [loading, queue.length, finished, finishSession]);

  const ratingByKey = useMemo(() => new Map(RATINGS.map((r) => [r.key, r.rating])), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (finished || loading || !currentCard) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (!revealed) handleReveal();
        return;
      }

      if (revealed) {
        const rating = ratingByKey.get(e.key);
        if (rating) {
          e.preventDefault();
          handleRate(rating);
          return;
        }
      }

      if ((e.key === 'a' || e.key === 'A') && currentCard.type === 'VOCABULARY') {
        window.speechSynthesis?.cancel();
        const utterance = new SpeechSynthesisUtterance(currentCard.word);
        utterance.lang = 'en-US';
        window.speechSynthesis?.speak(utterance);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finished, loading, currentCard, revealed, handleReveal, handleRate, ratingByKey]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (finished) {
    const totalAnswered = stats.correct + stats.incorrect;
    const accuracy = totalAnswered > 0 ? Math.round((stats.correct / totalAnswered) * 100) : 0;
    const minutes = Math.max(1, Math.round((Date.now() - stats.startedAt) / 60000));
    const nothingToDo = totalAnswered === 0;

    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-12 text-center animate-pop-in">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <Icon name="checkCircle" className="h-9 w-9 text-success" strokeWidth={1.6} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {nothingToDo ? 'Nic do powtórki!' : 'Sesja zakończona!'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {deckName}
            {mode !== 'mixed' && ` · tryb: ${STUDY_MODE_LABEL[mode].toLowerCase()}`}
          </p>
        </div>

        {!nothingToDo && (
          <>
            <div className="grid w-full grid-cols-3 gap-3">
              <Card className="p-4">
                <p className="font-display text-xl font-semibold text-success">{stats.correct}</p>
                <p className="text-xs text-ink-faint">Zapamiętane</p>
              </Card>
              <Card className="p-4">
                <p className="font-display text-xl font-semibold text-danger">{stats.incorrect}</p>
                <p className="text-xs text-ink-faint">Do powtórki</p>
              </Card>
              <Card className="p-4">
                <p className="font-display text-xl font-semibold text-ink">{accuracy}%</p>
                <p className="text-xs text-ink-faint">Skuteczność</p>
              </Card>
            </div>
            <p className="text-xs text-ink-faint">Czas nauki: ~{minutes} min</p>
          </>
        )}

        {nothingToDo && (
          <p className="max-w-xs text-sm text-ink-muted">
            Harmonogram SM-2 nie ma dziś nic zaplanowanego w tym zestawie. Wróć jutro albo zacznij nowe fiszki.
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate(`/decks/${deckId}`)}>
            Wróć do zestawu
          </Button>
          {nothingToDo && mode !== 'new' && (
            <Button variant="teal" onClick={() => navigate(`/study/${deckId}?mode=new`)}>
              Ucz się nowych
            </Button>
          )}
          <Button onClick={() => navigate('/dashboard')}>Panel główny</Button>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  // A failed card is spliced out and reinserted later in `queue`, so the
  // array's length is unchanged; it only shrinks when a card is graded OK or
  // better and leaves the session for good — exactly what "done" should mean
  // for the progress bar.
  const doneCount = Math.max(0, sessionTotal - queue.length);
  const isVocabulary = currentCard.type === 'VOCABULARY';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="font-medium text-ink">{deckName}</span>
            {mode !== 'mixed' && <Badge tone="accent">{STUDY_MODE_LABEL[mode]}</Badge>}
          </span>
          <span className="flex items-center gap-3 text-ink-muted">
            <span className="flex items-center gap-1">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {formatElapsed(elapsed)}
            </span>
            <span className="tabular-nums">
              {Math.min(doneCount, sessionTotal)} / {sessionTotal}
            </span>
          </span>
        </div>
        <ProgressBar
          value={(doneCount / Math.max(1, sessionTotal)) * 100}
          label="Postęp sesji nauki"
        />
      </div>

      <div className="flip-scene">
        <div className={`flip-inner ${revealed ? 'is-flipped' : ''}`}>
          {/* FRONT — both faces stay mounted for the 3D flip, so the one
              turned away is hidden from assistive tech and its controls are
              disabled to keep them out of the tab order. */}
          <Card
            aria-hidden={revealed}
            className="flip-face flex min-h-[20rem] flex-col items-center justify-center gap-5 p-6 text-center sm:min-h-[22rem] sm:p-8"
          >
            <div className="flex items-center gap-2">
              <Badge tone={CARD_TYPE_TONE[currentCard.type]}>{CARD_TYPE_LABEL[currentCard.type]}</Badge>
              <Badge>{currentCard.level}</Badge>
              {currentCard.mastered && <Badge tone="success">Opanowana</Badge>}
            </div>

            <h2 className="font-display text-card font-bold text-ink sm:text-card-lg">{currentCard.word}</h2>

            {currentCard.partOfSpeech && <span className="text-sm text-ink-faint">{currentCard.partOfSpeech}</span>}
            {isVocabulary && <AudioButton word={currentCard.word} />}

            <Button size="lg" onClick={handleReveal} disabled={revealed} className="mt-2 w-full sm:w-auto">
              Pokaż odpowiedź
              <kbd className="ml-1 rounded bg-white/15 px-1.5 text-xs">Space</kbd>
            </Button>
          </Card>

          {/* BACK */}
          <Card
            aria-hidden={!revealed}
            className="flip-face flip-face-back flex min-h-[20rem] flex-col gap-4 overflow-y-auto p-6 text-left sm:min-h-[22rem] sm:p-8"
          >
            <div className="text-center">
              <h2 className="font-display text-xl font-bold text-ink">{currentCard.word}</h2>
              {currentCard.pronunciationIpa && (
                <p className="mt-0.5 text-sm text-ink-faint">{currentCard.pronunciationIpa}</p>
              )}
            </div>

            {currentCard.translationPl && (
              <div className="rounded-xl bg-accent-soft/60 p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  {isVocabulary ? 'Tłumaczenie' : 'Po polsku'}
                </p>
                <p className="mt-0.5 font-display text-lg font-semibold text-ink">{currentCard.translationPl}</p>
              </div>
            )}

            {currentCard.meaningEn && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {isVocabulary ? 'Znaczenie' : 'Budowa'}
                </p>
                <p className="text-sm text-ink">{currentCard.meaningEn}</p>
              </div>
            )}

            {currentCard.explanation && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Wyjaśnienie</p>
                <p className="text-sm text-ink-muted">{currentCard.explanation}</p>
              </div>
            )}

            {currentCard.exampleSentence && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Przykład</p>
                <p className="text-sm italic text-ink-muted">„{currentCard.exampleSentence}”</p>
              </div>
            )}

            {isVocabulary && (
              <div className="flex justify-center">
                <AudioButton word={currentCard.word} size="sm" />
              </div>
            )}

            <div className="mt-auto border-t border-border pt-4">
              <p className="mb-2 text-center text-xs text-ink-faint">Jak dobrze pamiętałeś?</p>
              <RatingButtons onRate={handleRate} disabled={submitting || !revealed} />
            </div>
          </Card>
        </div>
      </div>

      {/* Preloads the next card's audio voice list and keeps the user oriented. */}
      {nextCard && (
        <p className="text-center text-xs text-ink-faint">
          Następna: <span className="text-ink-muted">{nextCard.word}</span>
        </p>
      )}

      <p className="hidden text-center text-xs text-ink-faint sm:block">
        <kbd>Space</kbd> odpowiedź · <kbd>1</kbd>-<kbd>5</kbd> ocena · <kbd>A</kbd> wymowa
      </p>
    </div>
  );
}
