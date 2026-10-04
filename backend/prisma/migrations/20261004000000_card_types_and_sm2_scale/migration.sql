-- Extend the grading scale to the full SM-2 range. The new values are only
-- written by application code from the next deploy onwards, so adding them
-- here is safe inside Prisma's migration transaction (PostgreSQL only
-- forbids *using* a value in the same transaction that creates it).
ALTER TYPE "ReviewRating" ADD VALUE 'OK' BEFORE 'GOOD';
ALTER TYPE "ReviewRating" ADD VALUE 'EASY' AFTER 'GOOD';

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('VOCABULARY', 'GRAMMAR', 'TENSES');

-- CreateEnum
CREATE TYPE "CardLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1');

-- AlterTable
ALTER TABLE "Card"
  ADD COLUMN "explanation" VARCHAR(1000),
  ADD COLUMN "type" "CardType" NOT NULL DEFAULT 'VOCABULARY',
  ADD COLUMN "level" "CardLevel" NOT NULL DEFAULT 'A1';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "quality" INTEGER NOT NULL DEFAULT 0;

-- Backfill the quality of historical reviews using the three-button mapping
-- that was in force when they were recorded (AGAIN=0, HARD=3, GOOD=5).
UPDATE "Review"
SET "quality" = CASE "rating"::text
  WHEN 'AGAIN' THEN 0
  WHEN 'HARD' THEN 3
  WHEN 'GOOD' THEN 5
  ELSE 0
END;

-- CreateIndex
CREATE INDEX "Card_deckId_type_idx" ON "Card"("deckId", "type");

-- CreateIndex
CREATE INDEX "Card_deckId_level_idx" ON "Card"("deckId", "level");
