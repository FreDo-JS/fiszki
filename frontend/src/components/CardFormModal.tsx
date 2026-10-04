import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button, Input, Select, TextArea } from './ui';
import { AudioButton } from './AudioButton';
import { Icon } from './Icon';
import { Card as CardType, CardLevel, CardType as CardKind } from '../api/types';
import * as cardsApi from '../api/cards';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { CARD_LEVELS, CARD_TYPES, CARD_TYPE_LABEL } from '../utils/cards';

export interface CardFormValues {
  word: string;
  meaningEn?: string;
  translationPl?: string;
  exampleSentence?: string;
  explanation?: string;
  pronunciationIpa?: string;
  partOfSpeech?: string;
  type: CardKind;
  level: CardLevel;
  tags: string[];
}

const EMPTY: CardFormValues = {
  word: '',
  meaningEn: '',
  translationPl: '',
  exampleSentence: '',
  explanation: '',
  pronunciationIpa: '',
  partOfSpeech: '',
  type: 'VOCABULARY',
  level: 'A1',
  tags: [],
};

// The front/back labels change with the card type: a vocabulary card has a
// word and a translation, a grammar or tense card has a rule and a formula.
const COPY: Record<CardKind, { front: string; frontHint: string; meaning: string; translation: string }> = {
  VOCABULARY: {
    front: 'Słówko / fraza',
    frontHint: 'np. abandon',
    meaning: 'Znaczenie (definicja po angielsku)',
    translation: 'Tłumaczenie (polski)',
  },
  GRAMMAR: {
    front: 'Zagadnienie gramatyczne',
    frontHint: 'np. Present Perfect - budowa',
    meaning: 'Konstrukcja (po angielsku)',
    translation: 'Konstrukcja (po polsku)',
  },
  TENSES: {
    front: 'Czas / zagadnienie',
    frontHint: 'np. Past Continuous',
    meaning: 'Budowa lub zastosowanie (po angielsku)',
    translation: 'Budowa lub zastosowanie (po polsku)',
  },
};

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
          explanation: initial.explanation ?? '',
          pronunciationIpa: initial.pronunciationIpa ?? '',
          partOfSpeech: initial.partOfSpeech ?? '',
          type: initial.type,
          level: initial.level,
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

  const isVocabulary = form.type === 'VOCABULARY';
  const copy = COPY[form.type];

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
      setError('To pole jest wymagane');
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
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Rodzaj"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CardKind }))}
          >
            {CARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {CARD_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select
            label="Poziom (CEFR)"
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as CardLevel }))}
          >
            {CARD_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label={copy.front}
              value={form.word}
              onChange={set('word')}
              error={error}
              maxLength={120}
              autoFocus
              placeholder={copy.frontHint}
            />
          </div>
          {isVocabulary && (
            <Button type="button" variant="secondary" onClick={handleGenerate} isLoading={generating}>
              <Icon name="sparkles" className="h-4 w-4" />
              Generuj
            </Button>
          )}
        </div>

        {isVocabulary && form.word.trim() && <AudioButton word={form.word.trim()} size="sm" />}

        <TextArea label={copy.meaning} value={form.meaningEn} onChange={set('meaningEn')} rows={2} maxLength={1000} />
        <Input label={copy.translation} value={form.translationPl} onChange={set('translationPl')} maxLength={500} />
        <TextArea
          label="Wyjaśnienie (dłuższy komentarz, wyjątki, pułapki)"
          value={form.explanation}
          onChange={set('explanation')}
          rows={2}
          maxLength={1000}
        />
        <TextArea label="Przykład użycia" value={form.exampleSentence} onChange={set('exampleSentence')} rows={2} maxLength={1000} />

        {isVocabulary && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Wymowa (IPA)" value={form.pronunciationIpa} onChange={set('pronunciationIpa')} maxLength={200} placeholder="/əˈbændən/" />
            <Input label="Część mowy" value={form.partOfSpeech} onChange={set('partOfSpeech')} maxLength={40} placeholder="verb, noun…" />
          </div>
        )}

        <Input
          label="Tagi (oddzielone przecinkami)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="np. business, phrasal-verbs"
        />
      </form>
    </Modal>
  );
}
