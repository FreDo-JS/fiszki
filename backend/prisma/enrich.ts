import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WordEntry {
  word: string;
  meaningEn: string | null;
  exampleSentence: string | null;
  pronunciationIpa: string | null;
  partOfSpeech: string | null;
  translationPl: string | null;
}

// Backfills flashcard content fields from the bundled vocabulary data.
//
// Unlike `npm run seed`, this NEVER deletes anything and never touches
// spaced-repetition state, reviews or progress — it only writes the content
// fields, on every card whose word matches, including cards inside decks
// users duplicated into their own collections.
//
// By default only EMPTY fields are filled. Pass --overwrite to also replace
// existing content with the bundled version; use that after correcting the
// source data, bearing in mind it discards manual edits to those fields.
const OVERWRITE = process.argv.includes('--overwrite');

async function main() {
  if (OVERWRITE) {
    console.log('Tryb --overwrite: istniejące treści zostaną zastąpione danymi z pliku.');
  }
  const dataPath = path.join(__dirname, 'seed-data', 'groups.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Nie znaleziono pliku z danymi słownictwa: ${dataPath}`);
  }
  const groups: Record<string, WordEntry[]> = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const byWord = new Map<string, WordEntry>();
  for (const words of Object.values(groups)) {
    for (const w of words) {
      const key = w.word.toLowerCase();
      const existing = byWord.get(key);
      // Prefer the richest entry when the same word appears more than once.
      if (!existing || score(w) > score(existing)) byWord.set(key, w);
    }
  }
  console.log(`Wczytano ${byWord.size} unikalnych haseł.`);

  const cards = await prisma.card.findMany({
    select: {
      id: true,
      word: true,
      meaningEn: true,
      translationPl: true,
      exampleSentence: true,
      pronunciationIpa: true,
      partOfSpeech: true,
    },
  });
  console.log(`Znaleziono ${cards.length} fiszek w bazie.`);

  let updated = 0;
  const BATCH = 500;
  let pending: Array<Promise<unknown>> = [];

  for (const card of cards) {
    const entry = byWord.get(card.word.toLowerCase());
    if (!entry) continue;

    const data: Record<string, string> = {};
    const put = (field: keyof typeof card, value: string | null) => {
      if (!value) return;
      const current = card[field] as string | null;
      if (current && !OVERWRITE) return;
      if (current === value) return;
      data[field as string] = value;
    };

    put('meaningEn', entry.meaningEn);
    put('translationPl', entry.translationPl);
    put('exampleSentence', entry.exampleSentence);
    put('pronunciationIpa', entry.pronunciationIpa);
    put('partOfSpeech', entry.partOfSpeech);

    if (Object.keys(data).length === 0) continue;

    pending.push(prisma.card.update({ where: { id: card.id }, data }));
    updated++;

    if (pending.length >= BATCH) {
      await Promise.all(pending);
      pending = [];
      console.log(`  zaktualizowano ${updated}…`);
    }
  }
  await Promise.all(pending);

  console.log(`\nGotowe. Uzupełniono ${updated} fiszek.`);

  const [total, withTranslation, withMeaning, withExample, withIpa] = await Promise.all([
    prisma.card.count(),
    prisma.card.count({ where: { translationPl: { not: null } } }),
    prisma.card.count({ where: { meaningEn: { not: null } } }),
    prisma.card.count({ where: { exampleSentence: { not: null } } }),
    prisma.card.count({ where: { pronunciationIpa: { not: null } } }),
  ]);
  console.log(`tłumaczenia: ${withTranslation}/${total}`);
  console.log(`definicje:   ${withMeaning}/${total}`);
  console.log(`przykłady:   ${withExample}/${total}`);
  console.log(`wymowa IPA:  ${withIpa}/${total}`);
}

function score(w: WordEntry): number {
  return (
    (w.meaningEn ? 1 : 0) +
    (w.translationPl ? 1 : 0) +
    (w.exampleSentence ? 1 : 0) +
    (w.pronunciationIpa ? 1 : 0)
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
