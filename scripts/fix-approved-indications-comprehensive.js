const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Comprehensive FDA-approved indications mapping by GENERIC name
 * This catches all brand names and biosimilars automatically
 */
const GENERIC_TO_INDICATIONS = {
  // Psoriasis + Hidradenitis Suppurativa
  'adalimumab': ['PSORIASIS', 'HIDRADENITIS_SUPPURATIVA'],  // Humira, Amjevita, Hyrimoz, etc.
  'secukinumab': ['PSORIASIS', 'HIDRADENITIS_SUPPURATIVA'],  // Cosentyx

  // Psoriasis only
  'risankizumab': ['PSORIASIS'],           // Skyrizi
  'guselkumab': ['PSORIASIS'],             // Tremfya
  'ustekinumab': ['PSORIASIS'],            // Stelara
  'ixekizumab': ['PSORIASIS'],             // Taltz
  'tildrakizumab': ['PSORIASIS'],          // Ilumya
  'brodalumab': ['PSORIASIS'],             // Siliq
  'infliximab': ['PSORIASIS'],             // Remicade + biosimilars
  'etanercept': ['PSORIASIS'],             // Enbrel + biosimilars
  'certolizumab': ['PSORIASIS'],           // Cimzia
  'apremilast': ['PSORIASIS'],             // Otezla

  // Atopic Dermatitis only
  'dupilumab': ['ATOPIC_DERMATITIS'],      // Dupixent
  'tralokinumab': ['ATOPIC_DERMATITIS'],   // Adbry
  'abrocitinib': ['ATOPIC_DERMATITIS'],    // Cibinqo

  // Dual indication: Psoriasis + Atopic Dermatitis
  'upadacitinib': ['PSORIASIS', 'ATOPIC_DERMATITIS'],  // Rinvoq
};

/**
 * Additional biosimilar suffixes to catch
 * e.g., adalimumab-atto, adalimumab-adaz, infliximab-dyyb, etc.
 */
function getBaseGenericName(genericName) {
  // Remove biosimilar suffixes like -atto, -adaz, -dyyb, etc.
  return genericName.split('-')[0];
}

async function fixApprovedIndications() {
  console.log('=== Comprehensive FDA Indications Fix ===\n');
  console.log('Updating all biologics and biosimilars based on generic names...\n');

  let totalUpdated = 0;

  // Process each generic drug
  for (const [genericBase, indications] of Object.entries(GENERIC_TO_INDICATIONS)) {

    // Update all drugs where genericName starts with this base
    // This catches biosimilars like adalimumab-atto, adalimumab-adaz, etc.
    const result = await prisma.formularyDrug.updateMany({
      where: {
        OR: [
          // Exact match
          { genericName: genericBase },
          // Biosimilar variants (e.g., adalimumab-atto)
          { genericName: { startsWith: `${genericBase}-` } },
          // Also catch by drug name if it matches
          { drugName: { contains: genericBase, mode: 'insensitive' } },
        ],
      },
      data: {
        approvedIndications: indications,
      },
    });

    if (result.count > 0) {
      totalUpdated += result.count;
      console.log(`✓ ${genericBase.padEnd(20)} → ${indications.join(', ').padEnd(50)} (${result.count} rows)`);
    }
  }

  console.log(`\n✓ Updated ${totalUpdated} total drug entries`);
  console.log('\nRefresh the assessment page to see corrected recommendations.');
}

fixApprovedIndications()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
