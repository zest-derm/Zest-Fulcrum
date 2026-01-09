-- Add formulation and strength fields to Recommendation table
-- These fields capture the specific formulation/package details of recommended drugs

ALTER TABLE "Recommendation" ADD COLUMN "formulation" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "strength" TEXT;

COMMENT ON COLUMN "Recommendation"."formulation" IS 'Drug formulation/package type (e.g., "2 Pen Kit", "Prefilled Syringe", "Tablet")';
COMMENT ON COLUMN "Recommendation"."strength" IS 'Drug strength/concentration (e.g., "40MG/0.8ML Subcutaneous", "300MG Dose Subcutaneous")';
