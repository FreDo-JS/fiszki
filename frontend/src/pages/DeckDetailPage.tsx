import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as decksApi from '../api/decks';
import * as cardsApi from '../api/cards';
import { Card as CardType, Deck } from '../api/types';
import { Badge, Button, EmptyState, Input, ProgressBar, Skeleton } from '../components/ui';
import { CardFormModal, CardFormValues } from '../components/CardFormModal';
import { ImportExportModal } from '../components/ImportExportModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AudioButton } from '../components/AudioButton';
import { Icon } from '../components/Icon';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<CardType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(searchParams.get('card'));

  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CardType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  const pageSize = 20;

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [deckData, cardsData] = await Promise.all([
        decksApi.getDeck(id),
        cardsApi.listCards({ deckId: id, search: debouncedSearch || undefined, page, pageSize }),
      ]);
      setDeck(deckData);
      setCards(cardsData.items);
      setTotal(cardsData.total);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
      navigate('/decks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, debouncedSearch, page]);

  const handleCreateCard = async (values: CardFormValues) => {
    if (!id) return;
    setSavingCard(true);
    try {
      await cardsApi.createCard({ deckId: id, ...values });
      showToast('Fiszka została dodana', 'success');
      setCardFormOpen(false);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSavingCard(false);
    }
  };

  const handleUpdateCard = async (values: CardFormValues) => {
    if (!editingCard) return;
    setSavingCard(true);
    try {
      await cardsApi.updateCard(editingCard.id, values);
      showToast('Zmiany zostały zapisane', 'success');
      setCardFormOpen(false);
      setEditingCard(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await cardsApi.deleteCard(deleteTarget.id);
      showToast('Fiszka została usunięta', 'success');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !deck) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!deck) return null;

  const canEdit = deck.owned;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">{deck.name}</h1>
            {deck.isPublic && <Badge tone="accent">Publiczny</Badge>}
          </div>
          {deck.description && <p className="mt-1 text-sm text-ink-muted">{deck.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button onClick={() => navigate(`/study/${deck.id}`)} disabled={deck.dueCount === 0}>
              {deck.dueCount > 0 ? `Rozpocznij naukę (${deck.dueCount})` : 'Brak fiszek do powtórki'}
            </Button>
          )}
          {!canEdit && (
            <Button
              onClick={async () => {
                const copy = await decksApi.duplicateDeck(deck.id);
                showToast('Zestaw zduplikowany do Twojej kolekcji', 'success');
                navigate(`/decks/${copy.id}`);
              }}
            >
              <Icon name="copy" className="h-4 w-4" />
              Duplikuj, aby się uczyć
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" onClick={() => setImportExportOpen(true)}>
              Import / Eksport
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-raised p-3">
          <p className="text-xs text-ink-faint">Fiszki</p>
          <p className="text-lg font-semibold text-ink">{deck.cardCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-3">
          <p className="text-xs text-ink-faint">Do powtórki</p>
          <p className="text-lg font-semibold text-accent">{deck.dueCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-3">
          <p className="text-xs text-ink-faint">Opanowane</p>
          <p className="text-lg font-semibold text-success">{deck.masteredCount}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-border bg-surface-raised p-3 sm:col-span-1">
          <p className="text-xs text-ink-faint">Postęp</p>
          <div className="mt-1.5">
            <ProgressBar value={deck.masteryPercent} tone="success" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Szukaj fiszek w tym zestawie…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="sm:max-w-xs" />
        {canEdit && (
          <Button
            onClick={() => {
              setEditingCard(null);
              setCardFormOpen(true);
            }}
          >
            + Dodaj fiszkę
          </Button>
        )}
      </div>

      {cards.length === 0 && !loading && (
        <EmptyState
          icon={<Icon name="inbox" className="h-8 w-8" />}
          title="Brak fiszek"
          description={canEdit ? 'Dodaj pierwszą fiszkę do tego zestawu.' : 'Ten zestaw nie zawiera jeszcze żadnych fiszek.'}
          action={canEdit ? <Button onClick={() => setCardFormOpen(true)}>+ Dodaj fiszkę</Button> : undefined}
        />
      )}

      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-border bg-surface-raised overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === card.id ? null : card.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-subtle transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium text-ink">{card.word}</span>
                {card.mastered && <Badge tone="success">Opanowana</Badge>}
                {card.tags.slice(0, 3).map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <span className="truncate text-sm text-ink-muted">{card.translationPl}</span>
            </button>
            {expandedId === card.id && (
              <div className="border-t border-border px-4 py-3 flex flex-col gap-2 animate-fade-in">
                {card.meaningEn && <p className="text-sm text-ink"><span className="font-medium text-ink-muted">Znaczenie:</span> {card.meaningEn}</p>}
                {card.translationPl && <p className="text-sm text-ink"><span className="font-medium text-ink-muted">Tłumaczenie:</span> {card.translationPl}</p>}
                {card.exampleSentence && <p className="text-sm italic text-ink-muted">"{card.exampleSentence}"</p>}
                {card.pronunciationIpa && <p className="text-sm text-ink-muted">{card.pronunciationIpa}</p>}
                <div className="mt-1 flex items-center justify-between">
                  <AudioButton word={card.word} size="sm" />
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingCard(card);
                          setCardFormOpen(true);
                        }}
                      >
                        Edytuj
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(card)}>
                        Usuń
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <Icon name="arrowLeft" className="h-4 w-4" />
            Poprzednia
          </Button>
          <span className="text-sm text-ink-muted">
            {page} / {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Następna
            <Icon name="arrowRight" className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CardFormModal
        open={cardFormOpen}
        onClose={() => {
          setCardFormOpen(false);
          setEditingCard(null);
        }}
        onSubmit={editingCard ? handleUpdateCard : handleCreateCard}
        initial={editingCard}
        loading={savingCard}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Usuń fiszkę"
        description={`Czy na pewno chcesz usunąć fiszkę "${deleteTarget?.word}"? Tej operacji nie można cofnąć.`}
        loading={deleting}
        onConfirm={handleDeleteCard}
        onCancel={() => setDeleteTarget(null)}
      />

      {id && (
        <ImportExportModal
          open={importExportOpen}
          onClose={() => setImportExportOpen(false)}
          deckId={id}
          deckName={deck.name}
          onImported={load}
        />
      )}
    </div>
  );
}
