import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button, Input, TextArea } from './ui';
import { Deck } from '../api/types';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#0891B2', '#7C3AED'];

export interface DeckFormValues {
  name: string;
  description?: string;
  color?: string;
  isPublic?: boolean;
}

export function DeckFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: DeckFormValues) => void;
  initial?: Deck | null;
  loading?: boolean;
}) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setColor(initial?.color ?? COLORS[0]);
      setIsPublic(initial?.isPublic ?? false);
      setError(undefined);
    }
  }, [open, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nazwa jest wymagana');
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim() || undefined, color, isPublic });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edytuj zestaw' : 'Nowy zestaw'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} isLoading={loading}>
            {initial ? 'Zapisz zmiany' : 'Utwórz zestaw'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nazwa zestawu" value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={120} autoFocus />
        <TextArea label="Opis (opcjonalnie)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-muted">Kolor</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-ink' : 'border-transparent'}`}
              />
            ))}
          </div>
        </div>

        {user?.role === 'ADMIN' && (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 rounded border-border accent-accent" />
            Zestaw publiczny (widoczny dla wszystkich użytkowników)
          </label>
        )}
      </form>
    </Modal>
  );
}
