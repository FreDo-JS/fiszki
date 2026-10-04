import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Icon, IconName } from './Icon';

const ITEMS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/dashboard', label: 'Panel', icon: 'home' },
  { to: '/decks', label: 'Zestawy', icon: 'layers' },
  { to: '/statistics', label: 'Statystyki', icon: 'chart' },
];

/**
 * Phone-only tab bar. The sidebar stays the navigation on tablets and up
 * (md:hidden here, md:block on the sidebar), and the safe-area padding keeps
 * the labels clear of the iOS home indicator.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Nawigacja główna"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around">
        {ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-ink-faint hover:text-ink-muted'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
