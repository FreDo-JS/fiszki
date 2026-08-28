import React from 'react';
import { Outlet } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
            <Icon name="book" className="h-6 w-6 text-accent" />
            Fiszki
          </span>
          <p className="mt-1 text-sm text-ink-muted">Nauka słownictwa angielskiego metodą powtórek rozłożonych w czasie</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-card sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
