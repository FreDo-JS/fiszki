import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import * as decksApi from '../api/decks';
import { Deck } from '../api/types';
import { ProgressBar, Skeleton } from './ui';
import { Icon, IconName } from './Icon';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/dashboard', label: 'Panel główny', icon: 'home' },
  { to: '/decks', label: 'Wszystkie zestawy', icon: 'layers' },
  { to: '/statistics', label: 'Statystyki', icon: 'chart' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
  );

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let alive = true;
    decksApi
      .listDecks()
      .then((d) => alive && setDecks(d.filter((deck) => deck.owned)))
      .catch(() => alive && setDecks([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Icon name="book" className="h-5 w-5 text-accent" />
        <span className="text-lg font-bold tracking-tight text-ink">Fiszki</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={onNavigate} className={linkClass}>
            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
        {user?.role === 'ADMIN' && (
          <NavLink to="/admin" onClick={onNavigate} className={linkClass}>
            <Icon name="shield" className="h-4 w-4 shrink-0" />
            Panel administratora
          </NavLink>
        )}
      </nav>

      <div className="mt-6 px-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Moje zestawy</div>
      <div className="mt-1 flex flex-col gap-1">
        {decks === null && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 mx-1" />)}
        {decks !== null && decks.length === 0 && (
          <p className="px-3 py-2 text-xs text-ink-faint">Nie masz jeszcze żadnych zestawów.</p>
        )}
        {decks?.map((deck) => (
          <NavLink
            key={deck.id}
            to={`/decks/${deck.id}`}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'flex flex-col gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
              )
            }
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{deck.name}</span>
              {deck.dueCount > 0 && (
                <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {deck.dueCount}
                </span>
              )}
            </span>
            <ProgressBar value={deck.masteryPercent} />
          </NavLink>
        ))}
      </div>
    </div>
  );
}
