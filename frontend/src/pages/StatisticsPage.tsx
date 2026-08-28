import React, { useEffect, useState } from 'react';
import * as statsApi from '../api/stats';
import { DailyStat, DeckProgress, StatsOverview } from '../api/types';
import { Card, ProgressBar, Skeleton } from '../components/ui';
import { StatCard } from '../components/StatCard';
import { BarChart } from '../components/BarChart';
import { ContributionCalendar } from '../components/ContributionCalendar';
import { formatDuration } from '../utils/format';

export default function StatisticsPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [range, setRange] = useState<7 | 30>(7);
  const [series, setSeries] = useState<DailyStat[] | null>(null);
  const [calendar, setCalendar] = useState<DailyStat[] | null>(null);
  const [deckProgress, setDeckProgress] = useState<DeckProgress[] | null>(null);

  useEffect(() => {
    statsApi.getOverview().then(setOverview);
    statsApi.getCalendar(182).then(setCalendar);
    statsApi.getDeckProgress().then(setDeckProgress);
  }, []);

  useEffect(() => {
    statsApi.getCharts(range).then(setSeries);
  }, [range]);

  const chartData = series?.map((d) => ({
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: range === 7 ? 'short' : undefined }),
    correct: d.correctCount,
    incorrect: d.incorrectCount,
  }));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">Statystyki</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {overview ? (
          <>
            <StatCard icon="layers" label="Wszystkie fiszki" value={overview.totalCards} />
            <StatCard icon="checkCircle" label="Opanowane" value={overview.masteredCards} tone="success" />
            <StatCard icon="plus" label="Nowe" value={overview.newCards} />
            <StatCard icon="clock" label="Do powtórki dziś" value={overview.dueToday} tone="warning" />
            <StatCard icon="trending" label="Skuteczność" value={`${overview.accuracy}%`} />
            <StatCard icon="repeat" label="Powtórki łącznie" value={overview.totalReviews} />
            <StatCard icon="clock" label="Czas nauki" value={formatDuration(overview.totalStudyTimeMs)} />
            <StatCard icon="flame" label={`Streak (rekord ${overview.bestStreak})`} value={`${overview.currentStreak} dni`} tone="warning" />
          </>
        ) : (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[68px]" />)
        )}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Aktywność w nauce</h2>
          <div className="flex gap-1 rounded-lg bg-surface-subtle p-1">
            <button
              onClick={() => setRange(7)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${range === 7 ? 'bg-surface-raised text-ink shadow-subtle' : 'text-ink-muted'}`}
            >
              7 dni
            </button>
            <button
              onClick={() => setRange(30)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${range === 30 ? 'bg-surface-raised text-ink shadow-subtle' : 'text-ink-muted'}`}
            >
              30 dni
            </button>
          </div>
        </div>
        {chartData ? <BarChart data={chartData} /> : <Skeleton className="h-48" />}
        <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" /> Poprawne
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-danger/60" /> Błędne
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-ink">Kalendarz nauki</h2>
        {calendar ? <ContributionCalendar series={calendar} /> : <Skeleton className="h-24" />}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-ink">Postęp według zestawów</h2>
        <div className="flex flex-col gap-3">
          {deckProgress === null && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          {deckProgress?.length === 0 && <p className="text-sm text-ink-faint">Brak zestawów do wyświetlenia.</p>}
          {deckProgress?.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm text-ink">{d.name}</span>
              <ProgressBar value={d.masteryPercent} tone="success" />
              <span className="w-24 shrink-0 text-right text-xs text-ink-muted">
                {d.masteredCount}/{d.cardCount} ({d.masteryPercent}%)
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
