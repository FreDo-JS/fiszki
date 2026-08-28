import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as cardsApi from '../api/cards';
import { useDebounce } from '../hooks/useDebounce';
import { Card } from '../api/types';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Card[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 350);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    cardsApi
      .listCards({ search: debounced, pageSize: 8 })
      .then((res) => alive && setResults(res.items))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Szukaj słówek, tłumaczeń, tagów…"
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {open && query.trim() && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface-raised shadow-raised animate-fade-in">
          {loading && <div className="px-4 py-3 text-sm text-ink-faint">Szukam…</div>}
          {!loading && results.length === 0 && <div className="px-4 py-3 text-sm text-ink-faint">Brak wyników</div>}
          {!loading &&
            results.map((card) => (
              <button
                key={card.id}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  navigate(`/decks/${card.deckId}?card=${card.id}`);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm hover:bg-surface-subtle transition-colors"
              >
                <span className="font-medium text-ink">{card.word}</span>
                <span className="text-xs text-ink-muted">{card.translationPl || card.meaningEn || '—'}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
