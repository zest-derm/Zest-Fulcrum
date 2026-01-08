# FDA Drug Data Update System

This system automatically fetches and maintains FDA drug label data for all biologics in the system using the openFDA API.

## Overview

- **Data Source:** openFDA API (`https://api.fda.gov/drug/label.json`)
- **Update Frequency:** Quarterly (every 3 months)
- **Storage:** `lib/fda-drug-data.json` (43 biologics)
- **API Limit:** 240 requests/minute (free, no API key required)

---

## Quick Start

### 1. Initial Setup (First Time Only)

```bash
# Install dependencies if needed
npm install

# Run the FDA data fetch script
npx tsx scripts/update-fda-data.ts
```

This will:
- Query openFDA for all 43 biologics
- Take ~3-4 minutes (rate-limited to 300ms per request)
- Save data to `lib/fda-drug-data.json`
- Display success/failure statistics

---

## Quarterly Update Process

**Run this every 3 months** (January, April, July, October):

```bash
# From project root:
npx tsx scripts/update-fda-data.ts
```

### What Gets Updated:

For each biologic:
- ✅ FDA-approved indications
- ✅ Contraindications
- ✅ Black Box Warnings
- ✅ General warnings
- ✅ Adverse reactions
- ✅ Dosage information

### After Update:

1. **Review** the updated `lib/fda-drug-data.json`
2. **Commit** changes to git
3. **Deploy** - FDA data is automatically used by the system

---

## Using FDA Data in Your Code

### Import the Helper

```typescript
import {
  getFDAData,
  getFDAIndications,
  getContraindications,
  getBlackBoxWarnings,
  hasBlackBoxWarning,
  isApprovedForIndication,
} from '@/lib/fda-drug-data-helper';
```

### Examples

```typescript
// Get all FDA data for a drug
const fdaData = getFDAData('Humira');
console.log(fdaData);
// {
//   brand: 'Humira',
//   generic: 'adalimumab',
//   fdaIndications: ['...'],
//   contraindications: ['...'],
//   blackBoxWarnings: ['...'],
//   lastUpdated: '2025-01-08T...'
// }

// Check if drug is approved for psoriasis
const isApproved = isApprovedForIndication('Humira', 'psoriasis');
// true

// Get black box warnings
const warnings = getBlackBoxWarnings('Humira');
// ['SERIOUS INFECTIONS', 'MALIGNANCY', ...]

// Check for specific warning
const hasTBWarning = hasBlackBoxWarning('Humira', 'tuberculosis');
// true

// Get contraindications
const contraindications = getContraindications('Cosentyx');
// ['Active tuberculosis', 'Hypersensitivity', ...]
```

---

## Integration Examples

### Example 1: Check Contraindications Before Recommending

```typescript
import { getBlackBoxWarnings } from '@/lib/fda-drug-data-helper';

function checkDrugSafety(drugName: string, patientConditions: string[]) {
  const blackBoxWarnings = getBlackBoxWarnings(drugName);

  // Check if patient has conditions mentioned in black box warnings
  for (const warning of blackBoxWarnings) {
    if (warning.toLowerCase().includes('heart failure') &&
        patientConditions.includes('HEART_FAILURE')) {
      return {
        contraindicated: true,
        reason: `BLACK BOX WARNING: ${warning}`,
        severity: 'ABSOLUTE',
      };
    }
  }

  return { contraindicated: false };
}
```

### Example 2: Display FDA Indications in UI

```typescript
import { getFDAIndications } from '@/lib/fda-drug-data-helper';

function DrugInfoCard({ drugName }: { drugName: string }) {
  const fdaIndications = getFDAIndications(drugName);

  return (
    <div>
      <h3>FDA-Approved Indications:</h3>
      <ul>
        {fdaIndications.map((indication, idx) => (
          <li key={idx}>{indication}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 3: Cite FDA Label in Recommendations

```typescript
import { getFDAData } from '@/lib/fda-drug-data-helper';

function addFDACitation(drugName: string) {
  const fdaData = getFDAData(drugName);

  if (fdaData) {
    return {
      citationNumber: 1,
      title: `${fdaData.brand} (${fdaData.generic}) FDA Label`,
      authors: "U.S. Food and Drug Administration",
      year: new Date(fdaData.lastUpdated).getFullYear(),
      journal: "FDA Drug Labels",
      specificFinding: "FDA-approved indications and safety information",
      source: "fda" as const,
      url: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${fdaData.brand}`,
    };
  }

  return null;
}
```

---

## Data Structure

### FDADrugData Interface

```typescript
interface FDADrugData {
  brand: string;                    // "Humira"
  generic: string;                  // "adalimumab"
  fdaIndications?: string[];        // FDA-approved uses
  contraindications?: string[];     // When NOT to use
  blackBoxWarnings?: string[];      // Serious warnings (highest severity)
  warnings?: string[];              // General warnings
  adverseReactions?: string[];      // Side effects
  dosageInfo?: string[];            // Dosing guidelines
  lastUpdated: string;              // ISO timestamp
  fdaSource: 'openfda' | 'manual';  // Data source
}
```

---

## Troubleshooting

### Script Fails to Run

```bash
# Make sure tsx is installed
npm install -g tsx

# Or use npx
npx tsx scripts/update-fda-data.ts
```

### Some Drugs Not Found

This is normal - some biosimilars or newer drugs may not be in openFDA yet. The script will:
- ✅ Log which drugs were found
- ⚠️  Log which were not found
- Continue processing all drugs

### Rate Limiting

The script automatically rate-limits to 300ms between requests (well under FDA's 240/min limit). If you get rate limit errors:
- Wait 1 minute
- Re-run the script

---

## Monitoring Data Freshness

### Check if Data Needs Refresh

```typescript
import { needsRefresh, getDataAge } from '@/lib/fda-drug-data-helper';

// Check if any drug data is > 90 days old
if (needsRefresh()) {
  console.warn('FDA data is stale - please run update script');
}

// Check specific drug
const age = getDataAge('Humira');
console.log(`Data is ${age} days old`);
```

### Add to CI/CD

Create a monthly reminder in your calendar or add to GitHub Actions:

```yaml
# .github/workflows/fda-data-reminder.yml
name: FDA Data Update Reminder
on:
  schedule:
    - cron: '0 9 1 */3 *'  # First day of every quarter at 9am

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Create Issue
        run: |
          gh issue create \
            --title "Quarterly FDA Data Update Due" \
            --body "Please run: npx tsx scripts/update-fda-data.ts"
```

---

## FAQ

### Q: Do I need an API key?
**A:** No, openFDA is free and doesn't require authentication for basic use (up to 240 requests/min).

### Q: What if FDA updates a label mid-quarter?
**A:** Run the script anytime! It's safe to run monthly or even weekly if needed.

### Q: Can I manually edit the JSON file?
**A:** Yes, but your changes will be overwritten on next update. For manual data, set `fdaSource: "manual"` and the script will skip it (future enhancement).

### Q: How do I handle drugs not in openFDA?
**A:** The script skips them and logs a warning. You can manually add them to the JSON file with `fdaSource: "manual"`.

---

## Next Steps

1. **Run initial fetch:** `npx tsx scripts/update-fda-data.ts`
2. **Review data:** Check `lib/fda-drug-data.json`
3. **Integrate:** Use helper functions in your code
4. **Schedule:** Set quarterly calendar reminder
5. **Monitor:** Check data freshness in production

---

## Support

If you encounter issues:
1. Check the openFDA API status: https://open.fda.gov/apis/status/
2. Review the console output for specific errors
3. Check network connectivity
4. Verify the drug names match FDA records

---

**Last Updated:** January 2025
**Next Update Due:** April 2025
