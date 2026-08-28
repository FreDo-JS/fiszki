import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as statsApi from '../api/stats';
import * as decksApi from '../api/decks';
import { StatsOverview, Deck } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Button, Card, EmptyState, Skeleton } from '../components/ui';
import { StatCard } from '../components/StatCard';
import { DeckCard } from '../components/DeckCard';
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

  useEffect(() => {
    statsApi.getOverview().then(setOverview);
    decksApi.listDecks().then((d) => setDecks(d.filter((deck) => deck.owned)));
  }, []);

  const bestDueDeck = decks?.slice().sort((a, b) => b.dueCount - a.dueCount)[0];
  const hasDue = (bestDueDeck?.dueCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          {greeting()}, {user?.username}!
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Oto Twój postęp w nauce słownictwa.</p>
      </div>

      <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">Dzisiejsza nauka</p>
          <p className="mt-1 text-3xl font-bold text-ink">
            {overview ? overview.dueToday : <Skeleton className="h-9 w-16" />}
            <span className="ml-2 text-base font-normal text-ink-muted">fiszek do powtórki</span>
          </p>
        </div>
        <Button
          size="lg"
          disabled={!hasDue}
          onClick={() => bestDueDeck && navigate(`/study/${bestDueDeck.id}`)}
        >
          {hasDue ? 'Rozpocznij naukę' : 'Brak fiszek na dziś'}
          {hasDue && <Icon name="arrowRight" className="h-4 w-4" />}
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {overview ? (
          <>
            <StatCard icon="flame" label={`Streak (rekord: ${overview.bestStreak})`} value={`${overview.currentStreak} dni`} tone="warning" />
            <StatCard icon="book" label="Opanowane słowa" value={overview.masteredCards} tone="success" />
            <StatCard icon="clock" label="Czas nauki" value={formatDuration(overview.totalStudyTimeMs)} />
            <StatCard icon="trending" label="Skuteczność" value={`${overview.accuracy}%`} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[68px]" />)
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Twoje zestawy</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/decks')}>
            Zobacz wszystkie
            <Icon name="arrowRight" className="h-4 w-4" />
          </Button>
        </div>

        {decks === null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        )}

        {decks?.length === 0 && (
          <EmptyState
            icon={<Icon name="inbox" className="h-8 w-8" />}
            title="Nie masz jeszcze żadnych zestawów"
            description="Utwórz swój pierwszy zestaw fiszek, aby rozpocząć naukę."
            action={
              <Button onClick={() => navigate('/decks')}>Utwórz zestaw</Button>
            }
          />
        )}

        {decks && decks.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.slice(0, 6).map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
