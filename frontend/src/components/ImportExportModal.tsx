import React, { useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button, TextArea } from './ui';
import { Icon } from './Icon';
import * as decksApi from '../api/decks';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

export function ImportExportModal({ open, onClose, deckId, deckName, onImported }: { open: boolean; onClose: () => void; deckId: string; deckName: string; onImported: () => void }) {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [content, setContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      showToast('Plik jest zbyt duży (maksymalnie 2MB)', 'error');
      return;
    }
    if (file.name.endsWith('.json')) setFormat('json');
    else setFormat('csv');
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!content.trim()) {
      showToast('Wklej lub wybierz plik do importu', 'error');
      return;
    }
    setImporting(true);
    try {
      const result = await decksApi.importCards(deckId, format, content);
      showToast(`Zaimportowano ${result.imported} fiszek${result.skipped ? `, pominięto ${result.skipped}` : ''}`, 'success');
      setContent('');
      onImported();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (exportFormat: 'csv' | 'json') => {
    setExporting(true);
    try {
      const data = await decksApi.exportCards(deckId, exportFormat);
      const blob = new Blob([data], { type: exportFormat === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deckName}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import / Eksport fiszek" maxWidth="max-w-xl">
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-subtle p-1">
        <button
          onClick={() => setTab('import')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${tab === 'import' ? 'bg-surface-raised text-ink shadow-subtle' : 'text-ink-muted'}`}
        >
          Import
        </button>
        <button
          onClick={() => setTab('export')}
          className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${tab === 'export' ? 'bg-surface-raised text-ink shadow-subtle' : 'text-ink-muted'}`}
        >
          Eksport
        </button>
      </div>

      {tab === 'import' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Wklej dane CSV lub JSON, albo wybierz plik. Wymagana kolumna: <code className="rounded bg-surface-subtle px-1 py-0.5 text-xs">word</code>. Opcjonalne:
            meaningEn, translationPl, exampleSentence, pronunciationIpa, partOfSpeech, tags.
          </p>
          <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFile} className="text-sm text-ink-muted" />
          <div className="flex gap-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} className="accent-accent" /> CSV
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={format === 'json'} onChange={() => setFormat('json')} className="accent-accent" /> JSON
            </label>
          </div>
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder={format === 'csv' ? 'word,meaningEn,translationPl,...' : '[{"word": "abandon", ...}]'} />
          <Button onClick={handleImport} isLoading={importing} className="self-end">
            Importuj fiszki
          </Button>
        </div>
      )}

      {tab === 'export' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">Pobierz wszystkie fiszki z tego zestawu w wybranym formacie.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => handleExport('csv')} isLoading={exporting}>
              <Icon name="download" className="h-4 w-4" />
              Eksportuj jako CSV
            </Button>
            <Button variant="secondary" onClick={() => handleExport('json')} isLoading={exporting}>
              <Icon name="download" className="h-4 w-4" />
              Eksportuj jako JSON
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
