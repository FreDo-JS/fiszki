import { ApiError } from '../utils/ApiError';

interface DictionaryEntry {
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string }>;
  }>;
}

export interface GeneratedFields {
  meaningEn: string | null;
  exampleSentence: string | null;
  pronunciationIpa: string | null;
  partOfSpeech: string | null;
}

const TIMEOUT_MS = 6000;

// Auto-generates an English definition, example sentence and IPA pronunciation
// for a word using the free, public dictionaryapi.dev lookup service. Users
// can always overwrite the result manually afterwards.
export async function generateCardFields(word: string): Promise<GeneratedFields> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Fiszki-App (educational flashcard generator)' },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { meaningEn: null, exampleSentence: null, pronunciationIpa: null, partOfSpeech: null };
      }
      throw ApiError.badRequest('Nie udało się wygenerować danych dla tego słowa. Spróbuj ponownie później.');
    }

    const data = (await res.json()) as DictionaryEntry[];
    const entry = data[0];
    if (!entry) {
      return { meaningEn: null, exampleSentence: null, pronunciationIpa: null, partOfSpeech: null };
    }

    let pronunciation = entry.phonetic ?? null;
    if (!pronunciation) {
      pronunciation = entry.phonetics?.find((p) => p.text)?.text ?? null;
    }

    let meaning: string | null = null;
    let example: string | null = null;
    let partOfSpeech: string | null = null;

    for (const m of entry.meanings ?? []) {
      for (const d of m.definitions ?? []) {
        if (!meaning && d.definition) {
          meaning = d.definition;
          partOfSpeech = m.partOfSpeech ?? null;
        }
        if (!example && d.example) {
          example = d.example;
        }
        if (meaning && example) break;
      }
      if (meaning && example) break;
    }

    return { meaningEn: meaning, exampleSentence: example, pronunciationIpa: pronunciation, partOfSpeech };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest('Serwis słownikowy jest chwilowo niedostępny. Spróbuj ponownie później.');
  } finally {
    clearTimeout(timeout);
  }
}
