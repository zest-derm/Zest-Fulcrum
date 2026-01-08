/**
 * Quarterly FDA Data Update Script
 *
 * Fetches latest FDA drug label data for all biologics using openFDA API
 * and merges with existing data in biologics-data.ts
 *
 * Usage: npx tsx scripts/update-fda-data.ts
 */

import fs from 'fs';
import path from 'path';

interface FDAResponse {
  results?: Array<{
    openfda?: {
      brand_name?: string[];
      generic_name?: string[];
      manufacturer_name?: string[];
    };
    indications_and_usage?: string[];
    contraindications?: string[];
    boxed_warning?: string[];
    warnings?: string[];
    adverse_reactions?: string[];
    dosage_and_administration?: string[];
  }>;
}

interface FDADrugData {
  brand: string;
  generic: string;
  fdaIndications?: string[];
  contraindications?: string[];
  blackBoxWarnings?: string[];
  warnings?: string[];
  adverseReactions?: string[];
  dosageInfo?: string[];
  lastUpdated: string;
  fdaSource: 'openfda' | 'manual';
}

/**
 * Query openFDA API for drug label data
 */
async function queryFDA(brandName: string, genericName: string): Promise<FDADrugData | null> {
  const baseUrl = 'https://api.fda.gov/drug/label.json';

  // Try brand name first, then generic
  const searchTerms = [
    `openfda.brand_name:"${brandName}"`,
    `openfda.generic_name:"${genericName}"`,
  ];

  for (const searchTerm of searchTerms) {
    try {
      const url = `${baseUrl}?search=${encodeURIComponent(searchTerm)}&limit=1`;
      console.log(`  Querying FDA for: ${brandName} (${genericName})...`);

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`  ⚠️  Not found in FDA database`);
          continue;
        }
        throw new Error(`FDA API error: ${response.status}`);
      }

      const data: FDAResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        continue;
      }

      const result = data.results[0];

      console.log(`  ✓ Found FDA data`);

      return {
        brand: brandName,
        generic: genericName,
        fdaIndications: result.indications_and_usage || [],
        contraindications: result.contraindications || [],
        blackBoxWarnings: result.boxed_warning || [],
        warnings: result.warnings || [],
        adverseReactions: result.adverse_reactions || [],
        dosageInfo: result.dosage_and_administration || [],
        lastUpdated: new Date().toISOString(),
        fdaSource: 'openfda',
      };
    } catch (error) {
      console.error(`  ❌ Error querying FDA: ${error}`);
    }
  }

  return null;
}

/**
 * Rate limit helper (FDA allows 240 requests per minute for unauthenticated)
 */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔄 Starting FDA data update...\n');

  // Read current biologics data
  const biologicsPath = path.join(process.cwd(), 'lib', 'biologics-data.ts');
  const biologicsContent = fs.readFileSync(biologicsPath, 'utf-8');

  // Extract brand and generic names using regex
  const drugMatches = biologicsContent.matchAll(/brand:\s*'([^']+)',\s*generic:\s*'([^']+)'/g);
  const drugs = Array.from(drugMatches).map(match => ({
    brand: match[1],
    generic: match[2],
  }));

  console.log(`Found ${drugs.length} biologics to update\n`);

  // Fetch FDA data for all drugs
  const fdaData: (FDADrugData | null)[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const drug of drugs) {
    const data = await queryFDA(drug.brand, drug.generic);
    fdaData.push(data);

    if (data) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limit: wait 300ms between requests (well under 240/min limit)
    await delay(300);
  }

  console.log(`\n📊 Results:`);
  console.log(`  ✓ Successfully fetched: ${successCount}`);
  console.log(`  ⚠️  Not found: ${failCount}`);

  // Save FDA data to JSON file
  const fdaOutputPath = path.join(process.cwd(), 'lib', 'fda-drug-data.json');
  fs.writeFileSync(
    fdaOutputPath,
    JSON.stringify(fdaData.filter(d => d !== null), null, 2),
    'utf-8'
  );

  console.log(`\n💾 Saved FDA data to: ${fdaOutputPath}`);
  console.log(`\n✅ Update complete!`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the data in lib/fda-drug-data.json`);
  console.log(`2. The data will be automatically used by the decision engine`);
  console.log(`3. Run this script quarterly to keep data current`);
}

main().catch(console.error);
