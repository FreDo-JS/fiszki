import React from 'react';

export interface BarChartSeries {
  label: string;
  correct: number;
  incorrect: number;
}

export function BarChart({ data }: { data: BarChartSeries[] }) {
  const max = Math.max(1, ...data.map((d) => d.correct + d.incorrect));

  return (
    <div className="flex h-48 items-end gap-1">
      {data.map((d, i) => {
        const total = d.correct + d.incorrect;
        const correctH = (d.correct / max) * 100;
        const incorrectH = (d.incorrect / max) * 100;
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-md" style={{ height: '11rem' }}>
              <div className="w-full bg-danger/60 transition-all" style={{ height: `${incorrectH}%` }} />
              <div className="w-full rounded-t-md bg-success transition-all" style={{ height: `${correctH}%` }} />
            </div>
            <span className="text-[10px] text-ink-faint">{d.label}</span>
            {total > 0 && (
              <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-medium text-surface opacity-0 shadow-raised transition-opacity group-hover:opacity-100">
                {total} powtórek
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
