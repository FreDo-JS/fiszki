import { useCallback, useEffect, useState } from 'react';

export type AccentPreference = 'en-GB' | 'en-US';

function pickVoice(voices: SpeechSynthesisVoice[], lang: AccentPreference): SpeechSynthesisVoice | undefined {
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
}

export function useSpeech() {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const speak = useCallback(
    (text: string, accent: AccentPreference = 'en-US') => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = accent;
      const voice = pickVoice(voices, accent);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    },
    [supported, voices]
  );

  return { supported, speak };
}
