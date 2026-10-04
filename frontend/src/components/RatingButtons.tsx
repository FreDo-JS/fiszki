import React from 'react';
import clsx from 'clsx';
import { Rating } from '../api/types';
import { RATINGS } from '../utils/cards';

/**
 * The five SM-2 grading buttons. A single row on desktop; on narrow screens
 * the grid wraps to three columns so every button keeps a comfortable touch
 * target instead of shrinking to a sliver.
 */
export function RatingButtons({
  onRate,
  disabled,
}: {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {RATINGS.map((meta) => (
        <button
          key={meta.rating}
          type="button"
          disabled={disabled}
          onClick={() => onRate(meta.rating)}
          title={`${meta.label} — ${meta.hint} (klawisz ${meta.key})`}
          aria-label={`${meta.label}: ${meta.hint}. Skrót: ${meta.key}`}
          className={clsx(
            'flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2.5 text-white',
            'transition-all duration-150 hover:brightness-110 active:scale-[0.97]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            meta.variant === 'danger' && 'bg-danger',
            meta.variant === 'caution' && 'bg-caution',
            meta.variant === 'warning' && 'bg-warning',
            meta.variant === 'teal' && 'bg-secondary',
            meta.variant === 'success' && 'bg-success'
          )}
        >
          <span className="text-sm font-semibold leading-tight">{meta.label}</span>
          <span className="text-[10px] uppercase tracking-wide text-white/75">q={meta.quality}</span>
          <kbd className="rounded bg-black/15 px-1.5 text-[10px] font-medium">{meta.key}</kbd>
        </button>
      ))}
    </div>
  );
}
