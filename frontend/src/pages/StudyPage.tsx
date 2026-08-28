import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as studyApi from '../api/study';
import * as decksApi from '../api/decks';
import { Card as CardType, Rating } from '../api/types';
import { Button, Card, ProgressBar, Spinner } from '../components/ui';
import { AudioButton } from '../components/AudioButton';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

interface SessionStats {
  correct: number;
  incorrect: number;
  startedAt: number;
}

export default function StudyPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [deckName, setDeckName] = useState('');
  const [queue, setQueue] = useState<CardType[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ correct: 0, incorrect: 0, startedAt: Date.now() });
  const shownAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!deckId) return;
    let alive = true;
    (async () => {
      try {
        const [deck, session, due] = await Promise.all([
          decksApi.getDeck(deckId),
          studyApi.startSession(deckId),
          studyApi.getDueQueue(deckId, 20),
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
  }, [deckId]);

  const currentCard = queue[index];

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
      try {
        await studyApi.submitReview({ cardId: currentCard.id, rating, responseTimeMs, sessionId: sessionId ?? undefined });
        setStats((s) => (rating === 'AGAIN' ? { ...s, incorrect: s.incorrect + 1 } : { ...s, correct: s.correct + 1 }));

        setQueue((prevQueue) => {
          const next = [...prevQueue];
          if (rating === 'AGAIN') {
            // Bring it back a little later in the same session instead of
            // tomorrow, so the user actually re-practices what they missed.
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
        // card out (or, for AGAIN, back in further down the array) always
        // shifts the next card down into slot 0, so we never advance it.
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [currentCard, submitting, revealed, sessionId, index]
  );

  useEffect(() => {
    if (!loading && queue.length === 0 && !finished) {
      finishSession();
    }
  }, [loading, queue.length, finished, finishSession]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (finished || loading || !currentCard) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!revealed) handleReveal();
      } else if (e.key === '1' && revealed) {
        handleRate('AGAIN');
      } else if (e.key === '2' && revealed) {
        handleRate('HARD');
      } else if (e.key === '3' && revealed) {
        handleRate('GOOD');
      } else if ((e.key === 'a' || e.key === 'A') && currentCard) {
        window.speechSynthesis?.cancel();
        const utterance = new SpeechSynthesisUtterance(currentCard.word);
        utterance.lang = 'en-US';
        window.speechSynthesis?.speak(utterance);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finished, loading, currentCard, revealed, handleReveal, handleRate]);

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

    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center animate-fade-in">
        <Icon name="checkCircle" className="h-12 w-12 text-success" strokeWidth={1.5} />
        <div>
          <h1 className="text-xl font-bold text-ink">Sesja nauki zakończona!</h1>
          <p className="mt-1 text-sm text-ink-muted">{deckName}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-lg font-semibold text-success">{stats.correct}</p>
            <p className="text-xs text-ink-faint">Poprawne</p>
          </Card>
          <Card className="p-4">
            <p className="text-lg font-semibold text-danger">{stats.incorrect}</p>
            <p className="text-xs text-ink-faint">Do powtórki</p>
          </Card>
          <Card className="p-4">
            <p className="text-lg font-semibold text-ink">{accuracy}%</p>
            <p className="text-xs text-ink-faint">Skuteczność</p>
          </Card>
        </div>
        <p className="text-xs text-ink-faint">Czas nauki: ~{minutes} min</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(`/decks/${deckId}`)}>
            Wróć do zestawu
          </Button>
          <Button onClick={() => navigate('/dashboard')}>Panel główny</Button>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  // A card rated AGAIN is spliced out and reinserted later in `queue`, so
  // the array's length is unchanged; it only shrinks when a card is
  // answered HARD/GOOD and leaves the session for good — exactly what
  // "done" should mean for the progress bar.
  const doneCount = Math.max(0, sessionTotal - queue.length);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-ink-muted">
          <span className="font-medium text-ink">{deckName}</span>
          <span>
            {Math.min(doneCount, sessionTotal)} / {sessionTotal}
          </span>
        </div>
        <ProgressBar value={(doneCount / Math.max(1, sessionTotal)) * 100} />
      </div>

      <div className="card-flip">
        <Card
          key={currentCard.id}
          className="flex min-h-[22rem] flex-col items-center justify-center gap-6 p-8 text-center animate-flip-in"
        >
          {!revealed ? (
            <>
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Słówko</span>
              <h2 className="text-4xl font-bold text-ink">{currentCard.word}</h2>
              {currentCard.partOfSpeech && <span className="text-sm text-ink-faint">{currentCard.partOfSpeech}</span>}
              <AudioButton word={currentCard.word} />
              <Button size="lg" onClick={handleReveal} className="mt-4">
                Pokaż odpowiedź <kbd className="ml-1 text-xs opacity-70">Space</kbd>
              </Button>
            </>
          ) : (
            <div className="flex w-full flex-col gap-4 text-left animate-fade-in">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-ink">{currentCard.word}</h2>
                {currentCard.pronunciationIpa && <p className="mt-0.5 text-sm text-ink-faint">{currentCard.pronunciationIpa}</p>}
              </div>

              {currentCard.meaningEn && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Znaczenie</p>
                  <p className="text-sm text-ink">{currentCard.meaningEn}</p>
                </div>
              )}
              {currentCard.translationPl && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Tłumaczenie</p>
                  <p className="text-sm text-ink">{currentCard.translationPl}</p>
                </div>
              )}
              {currentCard.exampleSentence && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Przykład</p>
                  <p className="text-sm italic text-ink-muted">"{currentCard.exampleSentence}"</p>
                </div>
              )}

              <div className="flex justify-center">
                <AudioButton word={currentCard.word} size="sm" />
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-4">
                <Button variant="danger" onClick={() => handleRate('AGAIN')} isLoading={submitting} className="flex-col !py-3">
                  <Icon name="cross" className="h-4 w-4" />
                  <span className="text-xs">Nie pamiętam</span>
                  <kbd className="text-[10px] opacity-70">1</kbd>
                </Button>
                <Button
                  onClick={() => handleRate('HARD')}
                  isLoading={submitting}
                  className="!bg-warning flex-col !py-3 text-white"
                >
                  <Icon name="dash" className="h-4 w-4" />
                  <span className="text-xs">Trudne</span>
                  <kbd className="text-[10px] opacity-70">2</kbd>
                </Button>
                <Button
                  onClick={() => handleRate('GOOD')}
                  isLoading={submitting}
                  className="!bg-success flex-col !py-3 text-white"
                >
                  <Icon name="check" className="h-4 w-4" />
                  <span className="text-xs">Pamiętam</span>
                  <kbd className="text-[10px] opacity-70">3</kbd>
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <p className="text-center text-xs text-ink-faint">
        Skróty: <kbd>Space</kbd> pokaż odpowiedź · <kbd>1</kbd> nie pamiętam · <kbd>2</kbd> trudne · <kbd>3</kbd> pamiętam · <kbd>A</kbd> audio
      </p>
    </div>
  );
}
