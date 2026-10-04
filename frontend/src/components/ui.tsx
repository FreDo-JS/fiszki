import React from 'react';
import clsx from 'clsx';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  isLoading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]',
        variant === 'primary' && 'bg-accent text-white hover:brightness-110 shadow-subtle',
        variant === 'secondary' && 'bg-surface-raised border border-border text-ink hover:bg-surface-subtle',
        variant === 'ghost' && 'text-ink-muted hover:bg-surface-raised hover:text-ink',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        variant === 'teal' && 'bg-secondary text-white hover:brightness-110 shadow-subtle',
        variant === 'success' && 'bg-success text-white hover:brightness-110 shadow-subtle',
        // Every size keeps a 44px-tall hit area, the WCAG 2.5.5 target size.
        size === 'sm' && 'min-h-touch px-3 py-1.5 text-sm',
        size === 'md' && 'min-h-touch px-4 py-2.5 text-sm',
        size === 'lg' && 'min-h-[3rem] px-6 py-3 text-base',
        className
      )}
      disabled={props.disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Input({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-muted">{label}</span>}
      <input
        className={clsx(
          'min-h-touch w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors',
          'focus:border-accent focus:ring-2 focus:ring-accent/20',
          error ? 'border-danger' : 'border-border',
          className
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function TextArea({ label, error, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-muted">{label}</span>}
      <textarea
        className={clsx(
          'w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors resize-none',
          'focus:border-accent focus:ring-2 focus:ring-accent/20',
          error ? 'border-danger' : 'border-border',
          className
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-muted">{label}</span>}
      <select
        className={clsx(
          'min-h-touch w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors',
          'focus:border-accent focus:ring-2 focus:ring-accent/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'teal';
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'default' && 'bg-surface-raised text-ink-muted border border-border',
        tone === 'success' && 'bg-success/10 text-success',
        tone === 'warning' && 'bg-warning/10 text-warning',
        tone === 'danger' && 'bg-danger/10 text-danger',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'teal' && 'bg-secondary-soft text-secondary',
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-2xl border border-border bg-surface-raised shadow-card', className)} {...props}>
      {children}
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-accent border-t-transparent',
        size === 'sm' && 'h-4 w-4',
        size === 'md' && 'h-6 w-6',
        size === 'lg' && 'h-10 w-10'
      )}
    />
  );
}

export function ProgressBar({
  value,
  tone = 'accent',
  size = 'md',
  label,
}: {
  value: number;
  tone?: 'accent' | 'success' | 'teal' | 'warning';
  size?: 'sm' | 'md';
  label?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={clsx('w-full overflow-hidden rounded-full bg-surface-subtle', size === 'sm' ? 'h-1.5' : 'h-2')}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={clsx(
          'h-full rounded-full transition-all duration-500 ease-out',
          tone === 'accent' && 'bg-accent',
          tone === 'success' && 'bg-success',
          tone === 'teal' && 'bg-secondary',
          tone === 'warning' && 'bg-warning'
        )}
        style={{ width: pct + '%' }}
      />
    </div>
  );
}

/**
 * Horizontal chip picker used by the type / level / mode filters. Built from
 * real radio inputs so it stays keyboard- and screen-reader-navigable, with
 * the chip styling moved onto the labels.
 */
export function ChipGroup<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            className={clsx(
              'inline-flex min-h-touch cursor-pointer select-none items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-accent bg-accent text-white shadow-subtle'
                : 'border-border bg-surface-raised text-ink-muted hover:border-accent/40 hover:text-ink'
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
            {opt.count !== undefined && (
              <span className={clsx('text-xs', active ? 'text-white/80' : 'text-ink-faint')}>{opt.count}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-surface-subtle', className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 px-6 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
