-- New table for structured clinical findings (better than raw chunks)
-- Each finding is a complete, clean sentence extracted by LLM from a paper

CREATE TABLE IF NOT EXISTS "ClinicalFinding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paperTitle" TEXT NOT NULL,
  "paperAuthors" TEXT NOT NULL,
  "citation" TEXT NOT NULL,  -- Full citation (e.g., "Atalay et al., J Dermatol Treat, 2021;33(3):1591-1597")
  "doi" TEXT,
  "pubmedId" TEXT,

  -- The actual finding (clean, complete sentence)
  "finding" TEXT NOT NULL,

  -- Categorization for filtering
  "drug" TEXT,  -- e.g., "adalimumab", "etanercept"
  "drugClass" TEXT,  -- e.g., "TNF_INHIBITOR"
  "indication" TEXT,  -- e.g., "PSORIASIS", "ATOPIC_DERMATITIS"
  "findingType" TEXT,  -- e.g., "EFFICACY", "SAFETY", "DOSE_REDUCTION", "INTERVAL_EXTENSION"

  -- Metadata
  "sourceFile" TEXT,
  "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "extractedBy" TEXT DEFAULT 'llm',  -- Can track if human-reviewed
  "reviewed" BOOLEAN DEFAULT false,

  -- Optional embedding for semantic search (if desired)
  "embedding" vector(1536),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Indexes for fast retrieval
CREATE INDEX "ClinicalFinding_drug_idx" ON "ClinicalFinding"("drug");
CREATE INDEX "ClinicalFinding_indication_idx" ON "ClinicalFinding"("indication");
CREATE INDEX "ClinicalFinding_findingType_idx" ON "ClinicalFinding"("findingType");
CREATE INDEX "ClinicalFinding_drugClass_idx" ON "ClinicalFinding"("drugClass");
CREATE INDEX "ClinicalFinding_reviewed_idx" ON "ClinicalFinding"("reviewed");

COMMENT ON TABLE "ClinicalFinding" IS 'Structured clinical findings extracted from research papers by LLM. Each row is a clean, complete sentence with citation.';
