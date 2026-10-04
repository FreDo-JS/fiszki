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
        {/* flex-1 + min-w-0 lets the title claim the leftover width and
            truncate; without it the badge below wins the fight and the name
            collapses to a single letter in a three-column grid. */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            // The 1A suffix is the alpha channel: an 10%-opacity tint of the
            // deck's own colour behind a full-strength glyph.
            style={{ backgroundColor: `${deck.color ?? '#2563EB'}1A`, color: deck.color ?? '#2563EB' }}
          >
            <Icon name="layers" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display font-semibold text-ink">{deck.name}</h3>
            <p className="whitespace-nowrap text-xs text-ink-faint">{deck.cardCount} fiszek</p>
          </div>
        </div>
        {/* Only the menu lives up here — the "public" badge moved to the
            footer, because together they left the title barely a character
            wide in a three-column grid. */}
        <div className="flex shrink-0 items-center gap-1">
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
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-ink-muted">
          <span>Opanowano {deck.masteryPercent}%</span>
          <span className="flex items-center gap-2">
            {deck.reviewCount > 0 && <span className="font-medium text-accent">{deck.reviewCount} powtórek</span>}
            {deck.newCount > 0 && <span className="font-medium text-secondary">{deck.newCount} nowych</span>}
          </span>
        </div>
        <ProgressBar value={deck.masteryPercent} tone="success" label={`Opanowanie: ${deck.name}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
        <span>Ostatnia nauka: {formatRelativeDate(deck.lastStudiedAt)}</span>
        {deck.isPublic && <Badge tone="accent">Publiczny</Badge>}
      </div>
    </Card>
  );
}
