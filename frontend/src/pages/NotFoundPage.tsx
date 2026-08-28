import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { Icon } from '../components/Icon';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-subtle text-center">
      <Icon name="search" className="h-10 w-10 text-ink-faint" />
      <h1 className="text-xl font-bold text-ink">Nie znaleziono strony</h1>
      <p className="text-sm text-ink-muted">Strona, której szukasz, nie istnieje.</p>
      <Link to="/dashboard">
        <Button>Wróć do panelu głównego</Button>
      </Link>
    </div>
  );
}
