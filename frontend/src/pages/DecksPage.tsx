import React, { useEffect, useState } from 'react';
import * as decksApi from '../api/decks';
import * as cardsApi from '../api/cards';
import { Deck } from '../api/types';
import { Button, EmptyState, Input, Skeleton } from '../components/ui';
import { DeckCard } from '../components/DeckCard';
import { DeckFormModal, DeckFormValues } from '../components/DeckFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const debouncedSearch = useDebounce(search, 350);
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Deck | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const data = await decksApi.listDecks({ search: debouncedSearch || undefined, tag: tag || undefined });
    setDecks(data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tag]);

  useEffect(() => {
    cardsApi.listTags().then((t) => setTags(t.map((x) => x.name)));
  }, []);

  const handleCreate = async (values: DeckFormValues) => {
    setSaving(true);
    try {
      await decksApi.createDeck(values);
      showToast('Zestaw został utworzony', 'success');
      setFormOpen(false);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values: DeckFormValues) => {
    if (!editingDeck) return;
    setSaving(true);
    try {
      await decksApi.updateDeck(editingDeck.id, values);
      showToast('Zmiany zostały zapisane', 'success');
      setFormOpen(false);
      setEditingDeck(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (deck: Deck) => {
    try {
      await decksApi.duplicateDeck(deck.id);
      showToast('Zestaw został zduplikowany', 'success');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await decksApi.deleteDeck(deleteTarget.id);
      showToast('Zestaw został usunięty', 'success');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-ink">Wszystkie zestawy</h1>
        <Button
          onClick={() => {
            setEditingDeck(null);
            setFormOpen(true);
          }}
        >
          + Nowy zestaw
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Szukaj zestawów…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        {tags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Wszystkie tagi</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {decks === null && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {decks?.length === 0 && (
        <EmptyState
          icon={<Icon name="inbox" className="h-8 w-8" />}
          title="Brak zestawów"
          description="Nie znaleziono żadnych zestawów pasujących do wyszukiwania."
          action={<Button onClick={() => setFormOpen(true)}>Utwórz nowy zestaw</Button>}
        />
      )}

      {decks && decks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onEdit={
                deck.owned || deck.isPublic
                  ? (d) => {
                      setEditingDeck(d);
                      setFormOpen(true);
                    }
                  : undefined
              }
              onDuplicate={handleDuplicate}
              onDelete={deck.owned ? (d) => setDeleteTarget(d) : undefined}
            />
          ))}
        </div>
      )}

      <DeckFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingDeck(null);
        }}
        onSubmit={editingDeck ? handleUpdate : handleCreate}
        initial={editingDeck}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Usuń zestaw"
        description={`Czy na pewno chcesz usunąć zestaw "${deleteTarget?.name}"? Ta operacja usunie również wszystkie fiszki w tym zestawie i nie można jej cofnąć.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
