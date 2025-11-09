-- AlterTable UploadLog - Add dataset tracking fields
ALTER TABLE "UploadLog" ADD COLUMN IF NOT EXISTS "datasetLabel" TEXT;
ALTER TABLE "UploadLog" ADD COLUMN IF NOT EXISTS "planId" TEXT;

-- AlterTable FormularyDrug - Add uploadLogId for dataset tracking
ALTER TABLE "FormularyDrug" ADD COLUMN IF NOT EXISTS "uploadLogId" TEXT;

-- AlterTable PharmacyClaim - Add uploadLogId for dataset tracking
ALTER TABLE "PharmacyClaim" ADD COLUMN IF NOT EXISTS "uploadLogId" TEXT;

-- CreateIndex for performance
CREATE INDEX IF NOT EXISTS "UploadLog_uploadType_uploadedAt_idx" ON "UploadLog"("uploadType", "uploadedAt");
CREATE INDEX IF NOT EXISTS "UploadLog_planId_idx" ON "UploadLog"("planId");
CREATE INDEX IF NOT EXISTS "FormularyDrug_uploadLogId_idx" ON "FormularyDrug"("uploadLogId");
CREATE INDEX IF NOT EXISTS "PharmacyClaim_uploadLogId_idx" ON "PharmacyClaim"("uploadLogId");

-- AddForeignKey
ALTER TABLE "UploadLog" ADD CONSTRAINT "UploadLog_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "InsurancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FormularyDrug" ADD CONSTRAINT "FormularyDrug_uploadLogId_fkey"
  FOREIGN KEY ("uploadLogId") REFERENCES "UploadLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PharmacyClaim" ADD CONSTRAINT "PharmacyClaim_uploadLogId_fkey"
  FOREIGN KEY ("uploadLogId") REFERENCES "UploadLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
