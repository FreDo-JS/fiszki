import React, { useState } from 'react';
import { useSpeech, AccentPreference } from '../hooks/useSpeech';
import { Icon } from './Icon';

export function AudioButton({ word, size = 'md' }: { word: string; size?: 'sm' | 'md' }) {
  const { supported, speak } = useSpeech();
  const [accent, setAccent] = useState<AccentPreference>('en-US');

  if (!supported || !word) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => speak(word, accent)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors ${
          size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        }`}
        title="Odtwórz wymowę"
      >
        <Icon name="volume" className="h-4 w-4" />
        Odtwórz audio
      </button>
      <div className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
        <button
          type="button"
          onClick={() => setAccent('en-GB')}
          className={`px-2 py-1 transition-colors ${
            accent === 'en-GB' ? 'bg-accent-soft text-accent' : 'text-ink-faint hover:bg-surface-subtle'
          }`}
          title="Wymowa brytyjska"
        >
          UK
        </button>
        <button
          type="button"
          onClick={() => setAccent('en-US')}
          className={`px-2 py-1 transition-colors ${
            accent === 'en-US' ? 'bg-accent-soft text-accent' : 'text-ink-faint hover:bg-surface-subtle'
          }`}
          title="Wymowa amerykańska"
        >
          US
        </button>
      </div>
    </div>
  );
}
