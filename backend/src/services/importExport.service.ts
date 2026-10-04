import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { stripHtml } from '../utils/sanitize';
import { parseCsv, toCsv } from '../utils/csv';
import { canRead, canWrite, getDeckOrThrow, DeckAuthContext } from './deck.service';
import { initialSrsState } from './sm2.service';

const MAX_IMPORT_ROWS = 2000;

// `type` and `level` are accepted in any casing and fall back to the schema
// defaults, so a CSV exported before these columns existed still imports.
const cardTypeCell = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(['VOCABULARY', 'GRAMMAR', 'TENSES']))
  .catch('VOCABULARY');

const cardLevelCell = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(['A1', 'A2', 'B1', 'B2', 'C1']))
  .catch('A1');

const importRowSchema = z.object({
  word: z.string().trim().min(1).max(120),
  meaningEn: z.string().trim().max(1000).optional().default(''),
  translationPl: z.string().trim().max(500).optional().default(''),
  exampleSentence: z.string().trim().max(1000).optional().default(''),
  explanation: z.string().trim().max(1000).optional().default(''),
  pronunciationIpa: z.string().trim().max(200).optional().default(''),
  partOfSpeech: z.string().trim().max(40).optional().default(''),
  type: cardTypeCell.optional().default('VOCABULARY'),
  level: cardLevelCell.optional().default('A1'),
  tags: z.string().trim().max(300).optional().default(''),
});

const importPayloadSchema = z.array(importRowSchema).max(MAX_IMPORT_ROWS);

const CSV_HEADERS = [
  'word',
  'meaningEn',
  'translationPl',
  'exampleSentence',
  'explanation',
  'pronunciationIpa',
  'partOfSpeech',
  'type',
  'level',
  'tags',
];

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

function rowsFromCsv(content: string) {
  const raw = parseCsv(content);
  if (raw.length === 0) return [];
  const [header, ...dataRows] = raw;
  const indexOf = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const idx = {
    word: indexOf('word'),
    meaningEn: indexOf('meaningEn'),
    translationPl: indexOf('translationPl'),
    exampleSentence: indexOf('exampleSentence'),
    explanation: indexOf('explanation'),
    pronunciationIpa: indexOf('pronunciationIpa'),
    partOfSpeech: indexOf('partOfSpeech'),
    type: indexOf('type'),
    level: indexOf('level'),
    tags: indexOf('tags'),
  };
  if (idx.word === -1) {
    throw ApiError.badRequest('Plik CSV musi zawierać kolumnę "word"');
  }
  return dataRows.map((cols) => ({
    word: cols[idx.word] ?? '',
    meaningEn: idx.meaningEn !== -1 ? cols[idx.meaningEn] ?? '' : '',
    translationPl: idx.translationPl !== -1 ? cols[idx.translationPl] ?? '' : '',
    exampleSentence: idx.exampleSentence !== -1 ? cols[idx.exampleSentence] ?? '' : '',
    explanation: idx.explanation !== -1 ? cols[idx.explanation] ?? '' : '',
    pronunciationIpa: idx.pronunciationIpa !== -1 ? cols[idx.pronunciationIpa] ?? '' : '',
    partOfSpeech: idx.partOfSpeech !== -1 ? cols[idx.partOfSpeech] ?? '' : '',
    type: idx.type !== -1 ? cols[idx.type] ?? '' : '',
    level: idx.level !== -1 ? cols[idx.level] ?? '' : '',
    tags: idx.tags !== -1 ? cols[idx.tags] ?? '' : '',
  }));
}

export async function importCards(
  user: DeckAuthContext,
  deckId: string,
  format: 'csv' | 'json',
  content: string
): Promise<ImportResult> {
  const deck = await getDeckOrThrow(deckId);
  if (!canWrite(user, deck)) throw ApiError.forbidden('Nie masz uprawnień do importu do tego zestawu');

  if (content.length > 2_000_000) {
    throw ApiError.badRequest('Plik jest zbyt duży (maksymalnie ~2MB)');
  }

  let rawRows: unknown[];
  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw ApiError.badRequest('Nieprawidłowy format JSON');
    }
    if (!Array.isArray(parsed)) {
      throw ApiError.badRequest('Oczekiwano tablicy obiektów fiszek w JSON');
    }
    rawRows = parsed;
  } else {
    rawRows = rowsFromCsv(content);
  }

  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw ApiError.badRequest(`Za dużo wierszy — maksymalnie ${MAX_IMPORT_ROWS} na jeden import`);
  }

  const parseResult = importPayloadSchema.safeParse(rawRows);
  const errors: string[] = [];
  let validRows: z.infer<typeof importPayloadSchema> = [];

  if (parseResult.success) {
    validRows = parseResult.data;
  } else {
    // Validate row-by-row so a single bad row doesn't reject the whole file.
    for (let i = 0; i < rawRows.length; i++) {
      const single = importRowSchema.safeParse(rawRows[i]);
      if (single.success) {
        validRows.push(single.data);
      } else {
        errors.push(`Wiersz ${i + 1}: nieprawidłowe dane`);
      }
    }
  }

  let imported = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      const word = stripHtml(row.word);
      if (!word) continue;

      const tagNames = row.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20);

      const tagIds: string[] = [];
      for (const name of [...new Set(tagNames)]) {
        const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
        tagIds.push(tag.id);
      }

      const srs = initialSrsState();
      await tx.card.create({
        data: {
          deckId,
          word,
          meaningEn: stripHtml(row.meaningEn) ?? null,
          translationPl: stripHtml(row.translationPl) ?? null,
          exampleSentence: stripHtml(row.exampleSentence) ?? null,
          explanation: stripHtml(row.explanation) ?? null,
          pronunciationIpa: stripHtml(row.pronunciationIpa) ?? null,
          partOfSpeech: stripHtml(row.partOfSpeech) ?? null,
          type: row.type,
          level: row.level,
          repetitions: srs.repetitions,
          intervalDays: srs.intervalDays,
          easeFactor: srs.easeFactor,
          lapses: srs.lapses,
          mastered: srs.mastered,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
      });
      imported++;
    }
  });

  return { imported, skipped: rawRows.length - imported, errors: errors.slice(0, 50) };
}

export async function exportCards(user: DeckAuthContext, deckId: string, format: 'csv' | 'json') {
  const deck = await getDeckOrThrow(deckId);
  if (!canRead(user, deck)) throw ApiError.forbidden('Nie masz dostępu do tego zestawu');

  const cards = await prisma.card.findMany({
    where: { deckId },
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const rows = cards.map((c) => ({
    word: c.word,
    meaningEn: c.meaningEn ?? '',
    translationPl: c.translationPl ?? '',
    exampleSentence: c.exampleSentence ?? '',
    explanation: c.explanation ?? '',
    pronunciationIpa: c.pronunciationIpa ?? '',
    partOfSpeech: c.partOfSpeech ?? '',
    type: c.type,
    level: c.level,
    tags: c.tags.map((t) => t.tag.name).join(','),
  }));

  if (format === 'json') {
    return { content: JSON.stringify(rows, null, 2), mime: 'application/json', filename: `${deck.name}.json` };
  }

  const csv = toCsv(
    CSV_HEADERS,
    rows.map((r) => CSV_HEADERS.map((h) => (r as Record<string, string>)[h]))
  );
  return { content: csv, mime: 'text/csv', filename: `${deck.name}.csv` };
}
