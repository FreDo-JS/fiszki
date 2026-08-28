import React from 'react';
import { DailyStat } from '../api/types';

function intensity(count: number): string {
  if (count === 0) return 'bg-surface-subtle';
  if (count < 5) return 'bg-accent/25';
  if (count < 15) return 'bg-accent/50';
  if (count < 30) return 'bg-accent/75';
  return 'bg-accent';
}

export function ContributionCalendar({ series }: { series: DailyStat[] }) {
  // Group into weeks (columns), Monday-first
  const weeks: DailyStat[][] = [];
  let currentWeek: DailyStat[] = [];

  series.forEach((day, i) => {
    // Append a time so the string is parsed in local time, not UTC — parsing
    // a bare "YYYY-MM-DD" as UTC can shift the weekday by one in negative
    // UTC-offset zones and misalign the whole grid.
    const dow = (new Date(`${day.date}T00:00:00`).getDay() + 6) % 7; // 0 = Monday
    if (i === 0) {
      for (let j = 0; j < dow; j++) currentWeek.push({ date: '', cardsReviewed: -1, correctCount: 0, incorrectCount: 0, studyTimeMs: 0, newCardsLearned: 0 });
    }
    currentWeek.push(day);
    if (dow === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length) weeks.push(currentWeek);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1" style={{ minWidth: `${weeks.length * 14}px` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) =>
              day.cardsReviewed === -1 ? (
                <div key={di} className="h-3 w-3" />
              ) : (
                <div
                  key={di}
                  title={`${day.date}: ${day.cardsReviewed} powtórek`}
                  className={`h-3 w-3 rounded-sm ${intensity(day.cardsReviewed)} transition-colors hover:ring-2 hover:ring-accent/50`}
                />
              )
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
        <span>Mniej</span>
        <div className="h-3 w-3 rounded-sm bg-surface-subtle" />
        <div className="h-3 w-3 rounded-sm bg-accent/25" />
        <div className="h-3 w-3 rounded-sm bg-accent/50" />
        <div className="h-3 w-3 rounded-sm bg-accent/75" />
        <div className="h-3 w-3 rounded-sm bg-accent" />
        <span>Więcej</span>
      </div>
    </div>
  );
}
