# Fix Dupixent Recommendation Issue

## Problem

Dupixent (approved for atopic dermatitis) is being recommended for psoriasis patients because your formulary data doesn't have the "Approved Indications" column populated.

## Root Cause

When you uploaded the formulary CSV, it didn't include an "Approved Indications" column, so all drugs got `approvedIndications: []` (empty array). The filtering code treats empty arrays as "approved for all diagnoses" for backward compatibility.

## Option 1: Run Fix Script (Quick - Recommended)

Update your existing database with correct indications:

```bash
npx ts-node scripts/fix-approved-indications.ts
```

This will:
- Set Skyrizi, Cosentyx, Stelara, etc. → `PSORIASIS`
- Set Dupixent → `ATOPIC_DERMATITIS`
- Set Humira → `PSORIASIS, HIDRADENITIS_SUPPURATIVA`
- Handle other common biologics

After running, restart dev server:
```bash
npm run dev
```

## Option 2: Re-upload Formulary with Correct Column

Download your formulary, add "Approved Indications" column:

```csv
Drug Name,Generic Name,Drug Class,Tier,Requires PA,Annual Cost,Approved Indications
Skyrizi,risankizumab,IL23 INHIBITOR,2,No,75000,PSORIASIS
Dupixent,dupilumab,IL4/13 INHIBITOR,2,No,48000,ATOPIC_DERMATITIS
Cosentyx,secukinumab,IL17 INHIBITOR,2,No,68000,PSORIASIS
Humira,adalimumab,TNF INHIBITOR,2,No,65000,"PSORIASIS, HIDRADENITIS_SUPPURATIVA"
```

### Valid Values:
- `PSORIASIS`
- `ATOPIC_DERMATITIS`
- `HIDRADENITIS_SUPPURATIVA`
- `OTHER`

For multiple indications, separate with commas and use quotes.

Then:
1. Go to Admin → Upload formulary
2. Select your plan (Aetna December 2024)
3. Upload the corrected CSV

This will create a NEW dataset. You can then delete the old one from Data Management.

## Verify Fix

After applying either fix:

1. Restart dev server: `npm run dev`
2. Go to Assessment page
3. Create assessment for Priya Alvarez (psoriasis patient)
4. You should see:
   - ✓ Skyrizi (psoriasis drug)
   - ✓ Cosentyx (psoriasis drug)
   - ✓ Tremfya (psoriasis drug)
   - ✗ NO Dupixent (atopic dermatitis drug)

## Console Log to Check

After fix, you should see in console:
```
Filtered formulary: 9 total → 3 for PSORIASIS → 3 safe
```

Not:
```
Filtered formulary: 9 total → 9 for PSORIASIS → 6 safe
```

The middle number (9 vs 3) shows how many drugs are approved for psoriasis.
