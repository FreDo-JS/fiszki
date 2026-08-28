import { beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma';

// Tests run against a real Postgres database (see README) and wipe these
// tables before every test to keep each test isolated. Never point
// DATABASE_URL at a database with real data when running the test suite.
async function cleanDatabase() {
  await prisma.$transaction([
    prisma.review.deleteMany(),
    prisma.studySession.deleteMany(),
    prisma.userProgress.deleteMany(),
    prisma.cardTag.deleteMany(),
    prisma.card.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.deck.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

beforeEach(async () => {
  try {
    await cleanDatabase();
  } catch (err) {
    // Pure unit tests (e.g. sm2.test.ts) don't touch the database at all,
    // so a missing test database shouldn't block them — any test that
    // actually needs Prisma will fail on its own with a clear connection
    // error instead.
    console.warn('[tests/setup] Could not reach the test database, skipping cleanup:', (err as Error).message);
  }
});

afterAll(async () => {
  try {
    await cleanDatabase();
  } catch {
    // see note above
  }
  await prisma.$disconnect();
});
