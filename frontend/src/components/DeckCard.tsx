import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deck } from '../api/types';
import { Badge, Card, ProgressBar } from './ui';
import { Icon } from './Icon';
import { formatRelativeDate } from '../utils/format';

export function DeckCard({
  deck,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  deck: Deck;
  onEdit?: (deck: Deck) => void;
  onDuplicate?: (deck: Deck) => void;
  onDelete?: (deck: Deck) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const showActions = onEdit || onDuplicate || onDelete;

  return (
    <Card
      className="relative flex cursor-pointer flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5 hover:shadow-raised"
      onClick={() => navigate(`/decks/${deck.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${deck.color ?? '#4F46E5'}1A`, color: deck.color ?? '#4F46E5' }}
          >
            <Icon name="layers" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink">{deck.name}</h3>
            <p className="text-xs text-ink-faint">{deck.cardCount} fiszek</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {deck.isPublic && <Badge tone="accent">Publiczny</Badge>}
          {showActions && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-lg px-1.5 py-1 text-ink-faint hover:bg-surface-subtle hover:text-ink transition-colors"
                aria-label="Więcej opcji"
              >
                <Icon name="more" className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-raised animate-fade-in"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  {onEdit && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(deck);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-ink hover:bg-surface-subtle"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                      Edytuj
                    </button>
                  )}
                  {onDuplicate && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDuplicate(deck);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-ink hover:bg-surface-subtle"
                    >
                      <Icon name="copy" className="h-4 w-4" />
                      Duplikuj
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(deck);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-danger hover:bg-surface-subtle"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                      Usuń
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>Opanowano {deck.masteryPercent}%</span>
          {deck.dueCount > 0 && <span className="font-medium text-accent">{deck.dueCount} do powtórki</span>}
        </div>
        <ProgressBar value={deck.masteryPercent} tone="success" />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>Ostatnia nauka: {formatRelativeDate(deck.lastStudiedAt)}</span>
      </div>
    </Card>
  );
}
