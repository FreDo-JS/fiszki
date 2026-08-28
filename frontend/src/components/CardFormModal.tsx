import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button, Input, TextArea } from './ui';
import { AudioButton } from './AudioButton';
import { Icon } from './Icon';
import { Card as CardType } from '../api/types';
import * as cardsApi from '../api/cards';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

export interface CardFormValues {
  word: string;
  meaningEn?: string;
  translationPl?: string;
  exampleSentence?: string;
  pronunciationIpa?: string;
  partOfSpeech?: string;
  tags: string[];
}

const EMPTY: CardFormValues = { word: '', meaningEn: '', translationPl: '', exampleSentence: '', pronunciationIpa: '', partOfSpeech: '', tags: [] };

export function CardFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CardFormValues) => void;
  initial?: CardType | null;
  loading?: boolean;
}) {
  const [form, setForm] = useState<CardFormValues>(EMPTY);
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          word: initial.word,
          meaningEn: initial.meaningEn ?? '',
          translationPl: initial.translationPl ?? '',
          exampleSentence: initial.exampleSentence ?? '',
          pronunciationIpa: initial.pronunciationIpa ?? '',
          partOfSpeech: initial.partOfSpeech ?? '',
          tags: initial.tags,
        });
        setTagsInput(initial.tags.join(', '));
      } else {
        setForm(EMPTY);
        setTagsInput('');
      }
      setError(undefined);
    }
  }, [open, initial]);

  const set = (key: keyof CardFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleGenerate = async () => {
    if (!form.word.trim()) {
      setError('Podaj słówko, aby wygenerować dane');
      return;
    }
    setGenerating(true);
    try {
      const fields = await cardsApi.generateFields(form.word.trim());
      setForm((f) => ({
        ...f,
        meaningEn: fields.meaningEn ?? f.meaningEn,
        exampleSentence: fields.exampleSentence ?? f.exampleSentence,
        pronunciationIpa: fields.pronunciationIpa ?? f.pronunciationIpa,
        partOfSpeech: fields.partOfSpeech ?? f.partOfSpeech,
      }));
      if (!fields.meaningEn && !fields.exampleSentence) {
        showToast('Nie znaleziono danych dla tego słowa — uzupełnij ręcznie', 'info');
      } else {
        showToast('Dane zostały wygenerowane — możesz je edytować', 'success');
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.word.trim()) {
      setError('Słówko jest wymagane');
      return;
    }
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({ ...form, tags });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edytuj fiszkę' : 'Nowa fiszka'}
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} isLoading={loading}>
            {initial ? 'Zapisz zmiany' : 'Dodaj fiszkę'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Słówko / fraza" value={form.word} onChange={set('word')} error={error} maxLength={120} autoFocus placeholder="np. abandon" />
          </div>
          <Button type="button" variant="secondary" onClick={handleGenerate} isLoading={generating}>
            <Icon name="sparkles" className="h-4 w-4" />
            Generuj
          </Button>
        </div>

        {form.word.trim() && <AudioButton word={form.word.trim()} size="sm" />}

        <TextArea label="Znaczenie (definicja po angielsku)" value={form.meaningEn} onChange={set('meaningEn')} rows={2} maxLength={1000} />
        <Input label="Tłumaczenie (polski)" value={form.translationPl} onChange={set('translationPl')} maxLength={500} />
        <TextArea label="Przykład użycia" value={form.exampleSentence} onChange={set('exampleSentence')} rows={2} maxLength={1000} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Wymowa (IPA)" value={form.pronunciationIpa} onChange={set('pronunciationIpa')} maxLength={200} placeholder="/əˈbændən/" />
          <Input label="Część mowy" value={form.partOfSpeech} onChange={set('partOfSpeech')} maxLength={40} placeholder="verb, noun…" />
        </div>

        <Input
          label="Tagi (oddzielone przecinkami)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="np. business, b1, phrasal-verbs"
        />
      </form>
    </Modal>
  );
}
