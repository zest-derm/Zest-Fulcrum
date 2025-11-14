# Clinical Findings Extraction System

## Overview

This system replaces the traditional RAG chunking approach with **structured extraction** of clinical findings from research papers.

### Why This Approach is Better

**Old Approach (Chunking/RAG):**
- ❌ Random 800-char chunks from PDFs
- ❌ Truncated sentences, metadata noise
- ❌ Incoherent snippets mixed with references
- ❌ LLM has to parse garbage to find meaning

**New Approach (Structured Extraction):**
- ✅ LLM reads entire paper once
- ✅ Extracts clean, complete sentences
- ✅ Each finding has explicit citation
- ✅ Physician-ready, no parsing needed
- ✅ Human review before production use

## Architecture

```
┌─────────────────┐
│  Research Paper │
│    (PDF)        │
└────────┬────────┘
         │
         ▼
  ┌──────────────────┐
  │   GPT-4 LLM      │
  │  Read & Extract  │
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────────────────────┐
  │  Structured Findings             │
  │  - Complete sentences            │
  │  - Full citations                │
  │  - Drug/indication tags          │
  │  - Finding type (safety, dose)   │
  └──────┬───────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────┐
  │  Database (ClinicalFinding)      │
  │  - Indexed by drug, indication   │
  │  - Fast retrieval                │
  │  - Human review status           │
  └──────┬───────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────┐
  │  LLM Decision Engine             │
  │  - Clean findings, no noise      │
  │  - Direct citations              │
  │  - Physician confidence          │
  └──────────────────────────────────┘
```

## Step-by-Step Guide

### Step 1: Delete Old Chunks (Optional)

If you want to start fresh:

```bash
# Check count first
curl http://localhost:3000/api/knowledge/delete-all

# Delete all old chunks
curl -X DELETE http://localhost:3000/api/knowledge/delete-all
```

### Step 2: Push Database Schema

```bash
npx prisma db push
```

This creates the `ClinicalFinding` table.

### Step 3: Extract Findings from PDFs

**Single PDF:**
```bash
npx ts-node scripts/extract-clinical-findings.ts path/to/paper.pdf
```

**Batch process directory:**
```bash
npx ts-node scripts/extract-clinical-findings.ts path/to/papers/
```

**What it does:**
1. Reads the entire PDF
2. Sends full text to GPT-4
3. GPT-4 extracts key findings as clean sentences
4. Saves to `ClinicalFinding` table with tags

**Example Output:**
```
📄 Processing: CONDOR_trial_2year_followup.pdf

📊 Extracted from: Two-year follow-up of a dose reduction strategy trial
   Authors: Atalay et al.
   Citation: Atalay et al., J Dermatol Treat, 2021;33(3):1591-1597
   Findings: 8

   Sample findings:
   1. The CONDOR trial demonstrated that 53% of patients with stable psoriasis maintained dose-reduced adalim...
   2. At 2-year follow-up, 41% of patients sustained low-dose biologic therapy without persistent flares or s...
   3. Dose reduction by extending adalimumab intervals to every 4 weeks was noninferior to usual care based o...

✅ Saved 8 findings
```

### Step 4: Review Extracted Findings

**CRITICAL:** Review findings before using in production!

```sql
-- View unreviewed findings
SELECT
  paperTitle,
  finding,
  drug,
  indication,
  citation
FROM "ClinicalFinding"
WHERE reviewed = false;

-- Mark findings as reviewed after verification
UPDATE "ClinicalFinding"
SET reviewed = true
WHERE id = 'finding-id-here';

-- Batch approve all findings from a trusted paper
UPDATE "ClinicalFinding"
SET reviewed = true
WHERE paperTitle LIKE '%CONDOR%';
```

### Step 5: Update Decision Engine (Optional)

To switch from chunked RAG to structured findings:

```typescript
// In lib/llm-decision-engine.ts, replace searchKnowledge() with:
import { searchClinicalFindings, formatFindingsForPrompt } from './clinical-findings';

// In the evidence retrieval section:
const findings = await searchClinicalFindings(
  genericDrugName,
  assessment.diagnosis,
  ['DOSE_REDUCTION', 'INTERVAL_EXTENSION', 'SAFETY']
);

const evidenceText = formatFindingsForPrompt(findings);
```

## Example: Before vs After

### Before (Chunked RAG):

```
📄 ljae068.pdf (chunk 60) (relevance 66%): a dose minimization strategy. A clinical
trial of patients with stable psoriasis investigated whether dose reduction of biologics
(adalimumab, etaner- cept and ustekinumab) was noninferior to usual care. While
noninferiority was not demonstrated based on PASI, dose reduction was noninferior
compared with usual care based on the Dermatology Life Quality Index...
```
☹️ Truncated, no clear citation, hard to parse

### After (Structured Extraction):

```
📄 CONDOR Trial: Dose Reduction of Biologics in Stable Psoriasis
Citation: Atalay et al., J Dermatol Treat, 2020;31(8):814-821
Finding: The CONDOR trial demonstrated that dose reduction of adalimumab, etanercept,
and ustekinumab in stable psoriasis patients was noninferior to usual care based on
Dermatology Life Quality Index scores, with no persistent flares observed over 12 months.
```
😊 Complete sentence, clear citation, physician-ready

## Database Schema

```sql
model ClinicalFinding {
  id              String    @id @default(cuid())

  -- Paper metadata
  paperTitle      String
  paperAuthors    String
  citation        String    -- Full citation
  doi             String?
  pubmedId        String?

  -- The finding (clean, complete sentence)
  finding         String    @db.Text

  -- Categorization
  drug            String?   -- "adalimumab"
  drugClass       String?   -- "TNF_INHIBITOR"
  indication      String?   -- "PSORIASIS"
  findingType     String?   -- "DOSE_REDUCTION"

  -- Quality control
  reviewed        Boolean   @default(false)
  extractedBy     String    @default("llm")

  -- Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

## Quality Control Workflow

1. **Extract** findings using GPT-4
2. **Review** findings manually:
   - Verify accuracy against paper
   - Check citation formatting
   - Ensure finding is complete sentence
3. **Approve** by setting `reviewed = true`
4. **Use** only reviewed findings in production

## Advanced: Adding PDF Parser

The extraction script currently expects plain text. To handle PDFs:

```bash
npm install pdf-parse
```

Then update `extract-clinical-findings.ts`:

```typescript
import pdfParse from 'pdf-parse';

async function processPDF(pdfPath: string) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);
  const paperText = pdfData.text;

  // Rest of extraction logic...
}
```

## Benefits for Your Business Model

1. **Physician Confidence**: Clean citations, no noise
2. **Accuracy**: LLM reads full paper, not random chunks
3. **Traceability**: Every finding has explicit citation
4. **Quality Control**: Human review before production
5. **No Hallucinations**: Findings grounded in actual papers
6. **Better UX**: Findings are physician-ready, not technical chunks

## Migration Path

You can run both systems in parallel:

1. Keep existing `KnowledgeDocument` chunks (for fallback)
2. Extract structured `ClinicalFinding` entries
3. Update decision engine to use structured findings
4. Once validated, deprecate chunked approach

## Next Steps

1. ✅ Delete old chunks (if desired)
2. ✅ Push database schema
3. ✅ Extract findings from papers
4. ⚠️ **Review findings manually** (CRITICAL!)
5. ✅ Update decision engine to use structured findings
6. ✅ Test with real patients
7. ✅ Deploy to production

---

**Questions?** Check the code comments or ask for help!
