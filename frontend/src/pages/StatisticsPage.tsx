import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import * as statsApi from '../api/stats';
import { Breakdowns, DailyStat, DeckProgress, StatsOverview } from '../api/types';
import { Card, ProgressBar, Skeleton } from '../components/ui';
import { StatCard } from '../components/StatCard';
import { BarChart } from '../components/BarChart';
import { BreakdownPanel } from '../components/BreakdownPanel';
import { ContributionCalendar } from '../components/ContributionCalendar';
import { formatDuration } from '../utils/format';

const RANGES = [7, 30] as const;
type Range = (typeof RANGES)[number];

export default function StatisticsPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [range, setRange] = useState<Range>(7);
  const [series, setSeries] = useState<DailyStat[] | null>(null);
  const [calendar, setCalendar] = useState<DailyStat[] | null>(null);
  const [deckProgress, setDeckProgress] = useState<DeckProgress[] | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);

  useEffect(() => {
    statsApi.getOverview().then(setOverview);
    statsApi.getCalendar(182).then(setCalendar);
    statsApi.getDeckProgress().then(setDeckProgress);
    statsApi.getBreakdowns().then(setBreakdowns);
  }, []);

  useEffect(() => {
    statsApi.getCharts(range).then(setSeries);
  }, [range]);

  const chartData = series?.map((d) => ({
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: range === 7 ? 'short' : undefined,
    }),
    correct: d.correctCount,
    incorrect: d.incorrectCount,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Statystyki</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Skuteczność liczona jest po SM-2: oceny „Nie pamiętam” i „Ledwo” (jakość poniżej 3) są błędami.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {overview ? (
          <>
            <StatCard icon="layers" label="Wszystkie fiszki" value={overview.totalCards} />
            <StatCard icon="checkCircle" label="Opanowane" value={overview.masteredCards} tone="success" />
            <StatCard icon="plus" label="Nowe" value={overview.newCards} />
            <StatCard icon="clock" label="W kolejce dziś" value={overview.dueToday} tone="warning" />
            <StatCard icon="trending" label="Skuteczność" value={`${overview.accuracy}%`} />
            <StatCard icon="repeat" label="Powtórki łącznie" value={overview.totalReviews} />
            <StatCard icon="clock" label="Czas nauki" value={formatDuration(overview.totalStudyTimeMs)} />
            <StatCard
              icon="flame"
              label={`Seria (rekord ${overview.bestStreak})`}
              value={`${overview.currentStreak} dni`}
              tone="warning"
            />
          </>
        ) : (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownPanel title="Postęp według rodzaju" icon="layers" rows={breakdowns?.byType ?? null} groupBy="type" />
        <BreakdownPanel title="Postęp według poziomu" icon="target" rows={breakdowns?.byLevel ?? null} groupBy="level" />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">Aktywność w nauce</h2>
          <div role="radiogroup" aria-label="Zakres wykresu" className="flex gap-1 rounded-xl bg-surface-subtle p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                onClick={() => setRange(r)}
                className={clsx(
                  'min-h-touch rounded-lg px-4 text-xs font-medium transition-colors',
                  range === r ? 'bg-surface-raised text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                )}
              >
                {r} dni
              </button>
            ))}
          </div>
        </div>
        {chartData ? <BarChart data={chartData} /> : <Skeleton className="h-48" />}
        <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" /> Zapamiętane
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-danger/60" /> Do powtórki
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-base font-semibold text-ink">Kalendarz nauki</h2>
        {calendar ? <ContributionCalendar series={calendar} /> : <Skeleton className="h-24" />}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-base font-semibold text-ink">Postęp według zestawów</h2>
        <div className="flex flex-col gap-4">
          {deckProgress === null && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          {deckProgress?.length === 0 && <p className="text-sm text-ink-faint">Brak zestawów do wyświetlenia.</p>}
          {deckProgress?.map((d) => (
            // Stacks on phones: a 32-wide name column plus a bar plus a count
            // leaves the bar a few pixels wide at 375px.
            <div key={d.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="truncate text-sm text-ink sm:w-40 sm:shrink-0">{d.name}</span>
              <ProgressBar value={d.masteryPercent} tone="success" label={`Postęp: ${d.name}`} />
              <span className="shrink-0 text-xs text-ink-muted sm:w-24 sm:text-right">
                {d.masteredCount}/{d.cardCount} ({d.masteryPercent}%)
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
