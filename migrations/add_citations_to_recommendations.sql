-- Migration: Add citations field to Recommendation table
-- This allows each recommendation to store inline citations with metadata

-- Step 1: Add citations column (JSONB array)
-- Schema: Each citation object contains:
--   - citationNumber: number (1, 2, 3... - unique within recommendation)
--   - title: string
--   - authors: string
--   - year: number
--   - journal: string
--   - pmid: string | null
--   - doi: string | null
--   - specificFinding: string (the data point cited, e.g., "PASI90 of 75%")
--   - source: "database" | "llm_generated" (whether it's from our DB or LLM-generated)

ALTER TABLE "Recommendation" ADD COLUMN "citations" JSONB DEFAULT '[]'::JSONB;

-- Step 2: Create index for better query performance on citations
CREATE INDEX "Recommendation_citations_idx" ON "Recommendation" USING GIN ("citations");

-- Step 3: Add comment to document the schema
COMMENT ON COLUMN "Recommendation"."citations" IS 'Array of citation objects with metadata. Each citation includes: citationNumber, title, authors, year, journal, pmid, doi, specificFinding, and source (database or llm_generated)';

-- Verify migration
SELECT id, "drugName", "citations" FROM "Recommendation" LIMIT 5;
