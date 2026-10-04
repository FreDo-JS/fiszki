import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as statsApi from '../api/stats';
import * as decksApi from '../api/decks';
import { Breakdowns, Deck, StatsOverview } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, EmptyState, Skeleton } from '../components/ui';
import { StatCard } from '../components/StatCard';
import { DeckCard } from '../components/DeckCard';
import { BreakdownPanel } from '../components/BreakdownPanel';
import { Icon } from '../components/Icon';
import { formatDuration } from '../utils/format';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Dzień dobry';
  if (hour < 18) return 'Miłego popołudnia';
  return 'Dobry wieczór';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);

  useEffect(() => {
    statsApi.getOverview().then(setOverview).catch(() => setOverview(null));
    statsApi.getBreakdowns().then(setBreakdowns).catch(() => setBreakdowns(null));
    decksApi
      .listDecks()
      .then((d) => setDecks(d.filter((deck) => deck.owned)))
      .catch(() => setDecks([]));
  }, []);

  // The review button needs cards the scheduler actually brought back, not
  // just anything whose dueDate has passed (a new card is due from birth).
  const bestDueDeck = decks?.slice().sort((a, b) => b.reviewCount - a.reviewCount)[0];
  const hasDue = (bestDueDeck?.reviewCount ?? 0) > 0;
  // "Learn new" needs a deck that still holds cards the scheduler has never
  // shown, so it picks the deck with the largest pool of unseen cards.
  const newCardsDeck = decks?.slice().sort((a, b) => b.newCount - a.newCount)[0];
  const hasNewCards = (newCardsDeck?.newCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          {greeting()}, {user?.username}!
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Oto Twój postęp w nauce angielskiego.</p>
      </div>

      {/* Hero: today's queue + the two quick actions from the spec. */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Dzisiejsza nauka</p>
            <p className="mt-1 flex items-baseline gap-2">
              {overview ? (
                <span className="font-display text-4xl font-bold text-ink">{overview.dueToday}</span>
              ) : (
                <Skeleton className="h-10 w-16" />
              )}
              <span className="text-base text-ink-muted">fiszek w kolejce</span>
            </p>
            {overview && overview.newCards > 0 && (
              <p className="mt-1 text-sm text-ink-faint">w tym {overview.newCards} jeszcze niewidzianych</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              disabled={!hasDue}
              onClick={() => bestDueDeck && navigate(`/study/${bestDueDeck.id}?mode=review`)}
            >
              {hasDue ? 'Powtarzaj' : 'Brak powtórek'}
              {hasDue && <Icon name="arrowRight" className="h-4 w-4" />}
            </Button>
            <Button
              size="lg"
              variant={hasDue ? 'secondary' : 'primary'}
              disabled={!hasNewCards}
              onClick={() => newCardsDeck && navigate(`/study/${newCardsDeck.id}?mode=new`)}
            >
              Ucz się nowych
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {overview ? (
          <>
            <StatCard
              icon="flame"
              label={`Seria (rekord: ${overview.bestStreak})`}
              value={`${overview.currentStreak} dni`}
              tone="warning"
            />
            <StatCard icon="book" label="Opanowane fiszki" value={overview.masteredCards} tone="success" />
            <StatCard icon="clock" label="Czas nauki" value={formatDuration(overview.totalStudyTimeMs)} />
            <StatCard icon="trending" label="Skuteczność" value={`${overview.accuracy}%`} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        )}
      </div>

      {/* Progress by card type and by CEFR level. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownPanel title="Postęp według rodzaju" icon="layers" rows={breakdowns?.byType ?? null} groupBy="type" />
        <BreakdownPanel title="Postęp według poziomu" icon="target" rows={breakdowns?.byLevel ?? null} groupBy="level" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Twoje zestawy</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/decks')}>
            Zobacz wszystkie
            <Icon name="arrowRight" className="h-4 w-4" />
          </Button>
        </div>

        {decks === null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        )}

        {decks?.length === 0 && (
          <EmptyState
            icon={<Icon name="inbox" className="h-8 w-8" />}
            title="Nie masz jeszcze żadnych zestawów"
            description="Zduplikuj jeden z publicznych zestawów startowych (słownictwo, gramatyka, czasy) albo utwórz własny."
            action={<Button onClick={() => navigate('/decks')}>Przeglądaj zestawy</Button>}
          />
        )}

        {decks && decks.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {decks.slice(0, 6).map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        )}
      </div>

      {overview && overview.totalReviews > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
          <Badge tone="accent">SM-2</Badge>
          Terminy powtórek wyznacza algorytm SuperMemo 2 na podstawie Twoich ocen 0-5.
        </p>
      )}
    </div>
  );
}
