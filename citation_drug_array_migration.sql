-- Migration: Change drugName from single string to array of strings
-- This allows systematic reviews and meta-analyses to be associated with multiple drugs

-- Step 1: Create a temporary column to hold the array
ALTER TABLE "Citation" ADD COLUMN "drugName_new" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Step 2: Copy existing drugName values into an array
UPDATE "Citation" SET "drugName_new" = ARRAY["drugName"];

-- Step 3: Drop the old column
ALTER TABLE "Citation" DROP COLUMN "drugName";

-- Step 4: Rename the new column
ALTER TABLE "Citation" RENAME COLUMN "drugName_new" TO "drugName";

-- Step 5: Make it NOT NULL (all existing data is already migrated)
ALTER TABLE "Citation" ALTER COLUMN "drugName" SET NOT NULL;

-- Step 6: Update the index to support array queries
DROP INDEX IF EXISTS "Citation_drugName_idx";
CREATE INDEX "Citation_drugName_idx" ON "Citation" USING GIN ("drugName");

-- Verify migration
SELECT id, "drugName", "pdfFileName" FROM "Citation" LIMIT 5;
