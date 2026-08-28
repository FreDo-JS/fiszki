import React from 'react';
import { Card } from './ui';
import { Icon, IconName } from './Icon';

export function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName;
  label: string;
  value: React.ReactNode;
  tone?: 'accent' | 'success' | 'warning';
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          tone === 'success'
            ? 'bg-success/10 text-success'
            : tone === 'warning'
            ? 'bg-warning/10 text-warning'
            : 'bg-accent-soft text-accent'
        }`}
      >
        <Icon name={icon} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-ink">{value}</p>
        <p className="truncate text-xs text-ink-muted">{label}</p>
      </div>
    </Card>
  );
}
