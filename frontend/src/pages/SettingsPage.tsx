import React, { useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import { Button, Card, Select, Skeleton } from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

// Round numbers a learner can reason about, plus the "off" case. 200 is the
// server-side ceiling, so the picker never offers something the API rejects.
const LIMIT_OPTIONS = [0, 5, 10, 15, 20, 30, 50, 100] as const;

function limitLabel(value: number): string {
  if (value === 0) return 'Bez nowych fiszek';
  return `${value} dziennie`;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [limit, setLimit] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.dailyNewLimit !== undefined) setLimit(user.dailyNewLimit);
  }, [user?.dailyNewLimit]);

  const handleSave = async () => {
    if (limit === null) return;
    setSaving(true);
    try {
      await authApi.updateSettings({ dailyNewLimit: limit });
      await refreshUser();
      showToast('Ustawienia zapisane', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const dirty = limit !== null && user?.dailyNewLimit !== undefined && limit !== user.dailyNewLimit;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Ustawienia</h1>
        <p className="mt-1 text-sm text-ink-muted">Tempo nauki i wygląd aplikacji.</p>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Dzienny limit nowych fiszek</h2>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              Ile fiszek, których jeszcze nie widziałeś, aplikacja wprowadzi w ciągu dnia. Powtórek limit nie
              dotyczy — one zawsze przychodzą w terminie wyznaczonym przez SM-2.
            </p>
          </div>
          <Icon name="target" className="mt-1 h-4 w-4 shrink-0 text-ink-faint" />
        </div>

        {limit === null ? (
          <Skeleton className="h-11 max-w-xs" />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Limit"
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="max-w-xs"
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {limitLabel(opt)}
                </option>
              ))}
            </Select>
            <Button onClick={handleSave} isLoading={saving} disabled={!dirty}>
              Zapisz
            </Button>
          </div>
        )}

        <p className="rounded-xl bg-surface-subtle p-3 text-xs text-ink-muted">
          Po co limit? Każda nowa fiszka wraca później jako kilka powtórek. Przerobienie 200 nowych jednego dnia
          oznacza lawinę powtórek w kolejnym tygodniu — dlatego domyślnie wprowadzamy 20 dziennie.
        </p>
      </Card>

      <Card className="flex items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Motyw</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Aktualnie: {theme === 'dark' ? 'ciemny' : 'jasny'}.
          </p>
        </div>
        <Button variant="secondary" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
          Przełącz
        </Button>
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <h2 className="font-display text-base font-semibold text-ink">Konto</h2>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-muted">Nazwa</dt>
          <dd className="text-ink">{user?.username ?? '—'}</dd>
          <dt className="text-ink-muted">E-mail</dt>
          <dd className="break-all text-ink">{user?.email ?? '—'}</dd>
          <dt className="text-ink-muted">Najdłuższa seria</dt>
          <dd className="text-ink">{user?.bestStreak ?? 0} dni</dd>
        </dl>
      </Card>
    </div>
  );
}
