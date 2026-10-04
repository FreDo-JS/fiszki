-- Per-user cap on how many never-seen cards the scheduler introduces per day.
ALTER TABLE "User" ADD COLUMN "dailyNewLimit" INTEGER NOT NULL DEFAULT 20;

-- Pre-review snapshot that makes a grading exactly reversible. Nullable on
-- purpose: rows written before this migration have no snapshot and are
-- therefore not undoable, which the API reports instead of guessing.
ALTER TABLE "Review"
  ADD COLUMN "prevDueDate" TIMESTAMP(3),
  ADD COLUMN "prevLapses" INTEGER,
  ADD COLUMN "prevMastered" BOOLEAN,
  ADD COLUMN "prevLastReviewedAt" TIMESTAMP(3);
