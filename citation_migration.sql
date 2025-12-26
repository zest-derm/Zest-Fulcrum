-- Citation System Migration for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Create enums
CREATE TYPE "CitationType" AS ENUM (
  'EFFICACY',
  'SAFETY',
  'BIOSIMILAR_EQUIVALENCE',
  'HEAD_TO_HEAD',
  'LONG_TERM_OUTCOMES',
  'PHARMACOKINETICS',
  'REAL_WORLD_EVIDENCE'
);

CREATE TYPE "StudyType" AS ENUM (
  'RCT',
  'SYSTEMATIC_REVIEW',
  'META_ANALYSIS',
  'OBSERVATIONAL',
  'CASE_SERIES',
  'REGISTRY'
);

CREATE TYPE "IndicationType" AS ENUM (
  'PSORIASIS',
  'PSORIATIC_ARTHRITIS',
  'ATOPIC_DERMATITIS',
  'HIDRADENITIS_SUPPURATIVA',
  'CROHNS_DISEASE',
  'ULCERATIVE_COLITIS',
  'RHEUMATOID_ARTHRITIS',
  'ANKYLOSING_SPONDYLITIS',
  'OTHER'
);

-- Create Citation table
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "journal" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "pmid" TEXT,
    "doi" TEXT,
    "studyType" "StudyType" NOT NULL,
    "citationType" "CitationType" NOT NULL,
    "sampleSize" INTEGER,
    "population" TEXT,
    "pdfPath" TEXT NOT NULL,
    "pdfFileName" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "keyFindings" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "indications" "IndicationType"[] DEFAULT ARRAY[]::"IndicationType"[],
    "referenceDrugName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance
CREATE INDEX "Citation_drugName_idx" ON "Citation"("drugName");
CREATE INDEX "Citation_citationType_idx" ON "Citation"("citationType");
CREATE INDEX "Citation_studyType_idx" ON "Citation"("studyType");
CREATE INDEX "Citation_indications_idx" ON "Citation" USING GIN ("indications");
CREATE INDEX "Citation_year_idx" ON "Citation"("year");
CREATE INDEX "Citation_reviewed_idx" ON "Citation"("reviewed");

-- Done!
SELECT 'Citation system migration completed successfully!' AS status;
