import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';
import { initialSrsState } from '../src/services/sm2.service';

const prisma = new PrismaClient();

interface WordEntry {
  word: string;
  meaningEn: string | null;
  exampleSentence: string | null;
  pronunciationIpa: string | null;
  partOfSpeech: string | null;
  translationPl: string | null;
}

// Groups 1-10 map to the CEFR bands the source list itself is labelled
// with (levels A1-C1 across 10 frequency bands of 500 words each).
const GROUP_LEVEL: Record<string, string> = {
  '1': 'a1',
  '2': 'a1',
  '3': 'a2',
  '4': 'a2',
  '5': 'b1',
  '6': 'b1',
  '7': 'b2',
  '8': 'b2',
  '9': 'c1',
  '10': 'c1',
};

// Each CEFR band gets its own accent colour; the UI renders a neutral glyph
// tinted with it rather than a per-deck emoji.
const LEVEL_COLOR: Record<string, string> = {
  a1: '#059669',
  a2: '#0891B2',
  b1: '#4F46E5',
  b2: '#7C3AED',
  c1: '#D97706',
};

async function main() {
  const dataPath = path.join(__dirname, 'seed-data', 'groups.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `Nie znaleziono pliku z danymi słownictwa: ${dataPath}. Uruchom najpierw skrypt przygotowujący dane (patrz README).`
    );
  }
  const groups: Record<string, WordEntry[]> = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Only the public starter decks this script owns are replaced. Decks that
  // users created or duplicated into their own collections — along with every
  // review, study session and streak — are deliberately left alone, so
  // re-running the seed to refresh the vocabulary never destroys progress.
  console.log('Tworzenie/aktualizacja kont startowych...');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fiszki.app' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@fiszki.app',
      passwordHash: await hashPassword('Admin1234'),
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'demo@fiszki.app' },
    update: {},
    create: {
      username: 'demo',
      email: 'demo@fiszki.app',
      passwordHash: await hashPassword('Demo1234'),
      role: 'USER',
    },
  });

  const removed = await prisma.deck.deleteMany({ where: { ownerId: admin.id, isPublic: true } });
  if (removed.count > 0) {
    console.log(`Zastąpiono ${removed.count} publicznych zestawów startowych.`);
  }

  console.log('Tworzenie tagów...');
  const levelNames = ['a1', 'a2', 'b1', 'b2', 'c1'];
  const groupTagNames = Object.keys(groups).map((g) => `grupa-${g}`);
  const allTagNames = [...levelNames, ...groupTagNames];
  await prisma.tag.createMany({ data: allTagNames.map((name) => ({ name })), skipDuplicates: true });
  const tags = await prisma.tag.findMany({ where: { name: { in: allTagNames } } });
  const tagIdByName = new Map(tags.map((t) => [t.name, t.id]));

  for (const [groupNum, words] of Object.entries(groups)) {
    const rangeStart = (Number(groupNum) - 1) * 500 + 1;
    const rangeEnd = Number(groupNum) * 500;
    const level = GROUP_LEVEL[groupNum] ?? 'b1';

    const deck = await prisma.deck.create({
      data: {
        name: `Grupa ${groupNum} · słowa ${rangeStart}-${rangeEnd} (${level.toUpperCase()})`,
        description: `${words.length} najczęściej używanych słów języka angielskiego (pozycje ${rangeStart}-${rangeEnd} listy frekwencyjnej).`,
        color: LEVEL_COLOR[level] ?? '#4F46E5',
        isPublic: true,
        ownerId: admin.id,
      },
    });

    console.log(`Tworzenie ${words.length} fiszek dla: ${deck.name}`);
    const srs = initialSrsState();
    const cardIds = words.map(() => randomUUID());

    await prisma.card.createMany({
      data: words.map((w, i) => ({
        id: cardIds[i],
        deckId: deck.id,
        word: w.word,
        meaningEn: w.meaningEn,
        translationPl: w.translationPl,
        exampleSentence: w.exampleSentence,
        pronunciationIpa: w.pronunciationIpa,
        partOfSpeech: w.partOfSpeech,
        repetitions: srs.repetitions,
        intervalDays: srs.intervalDays,
        easeFactor: srs.easeFactor,
        lapses: srs.lapses,
        mastered: srs.mastered,
      })),
    });

    const levelTagId = tagIdByName.get(level)!;
    const groupTagId = tagIdByName.get(`grupa-${groupNum}`)!;
    await prisma.cardTag.createMany({
      data: cardIds.flatMap((cardId) => [
        { cardId, tagId: levelTagId },
        { cardId, tagId: groupTagId },
      ]),
    });
  }

  const totalCards = await prisma.card.count();
  const totalDecks = await prisma.deck.count();
  console.log(`\nGotowe! Utworzono ${totalDecks} zestawów i ${totalCards} fiszek.`);
  console.log('Konto administratora: admin@fiszki.app / Admin1234');
  console.log('Konto demo: demo@fiszki.app / Demo1234');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
