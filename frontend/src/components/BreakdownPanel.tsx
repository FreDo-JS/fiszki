import React from 'react';
import { BreakdownRow, CardType } from '../api/types';
import { Card, ProgressBar, Skeleton } from './ui';
import { Icon, IconName } from './Icon';
import { CARD_TYPE_LABEL, CARD_TYPE_TONE } from '../utils/cards';

type Tone = 'accent' | 'teal' | 'warning' | 'success';

function BreakdownBar({ label, tone, row }: { label: string; tone: Tone; row: BreakdownRow }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-faint">
          {row.total === 0 ? 'brak fiszek' : `${row.mastered}/${row.total} opanowanych`}
          {row.due > 0 && <span className="ml-1.5 text-accent">· {row.due} na dziś</span>}
        </span>
      </div>
      <ProgressBar value={row.masteryPercent} tone={tone} size="sm" label={`Postęp: ${label}`} />
    </div>
  );
}

/**
 * Progress grouped by card type or by CEFR level. Shared by the dashboard and
 * the statistics page so both always tell the same story.
 */
export function BreakdownPanel({
  title,
  icon,
  rows,
  groupBy,
}: {
  title: string;
  icon: IconName;
  rows: BreakdownRow[] | null;
  groupBy: 'type' | 'level';
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        <Icon name={icon} className="h-4 w-4 text-ink-faint" />
      </div>

      {rows ? (
        <div className="flex flex-col gap-3.5">
          {rows.map((row) => (
            <BreakdownBar
              key={row.key}
              label={groupBy === 'type' ? CARD_TYPE_LABEL[row.key as CardType] ?? row.key : row.key}
              tone={groupBy === 'type' ? CARD_TYPE_TONE[row.key as CardType] ?? 'accent' : 'success'}
              row={row}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: groupBy === 'type' ? 3 : 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      )}
    </Card>
  );
}
