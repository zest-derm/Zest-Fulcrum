import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fix existing formulary data with correct approved indications
 * Based on drug names and known FDA approvals
 */
async function fixApprovedIndications() {
  console.log('Starting to fix approved indications...\n');

  // Psoriasis drugs
  const psoriasisDrugs = [
    'Skyrizi', 'Cosentyx', 'Stelara', 'Taltz', 'Tremfya',
    'Humira', 'Enbrel', 'Remicade', 'Simponi', 'Cimzia',
    'Otezla', 'Rinvoq', 'Sotyktu'
  ];

  // Atopic dermatitis drugs
  const atopicDermatitisDrugs = [
    'Dupixent', 'Adbry', 'Rinvoq', 'Cibinqo'
  ];

  // Hidradenitis suppurativa drugs
  const hidradenitisDrugs = [
    'Humira', 'Cosentyx'
  ];

  // Update psoriasis drugs
  for (const drugName of psoriasisDrugs) {
    const indications = ['PSORIASIS'];

    // Add HS indication if applicable
    if (hidradenitisDrugs.includes(drugName)) {
      indications.push('HIDRADENITIS_SUPPURATIVA');
    }

    // Add AD indication if applicable
    if (atopicDermatitisDrugs.includes(drugName)) {
      indications.push('ATOPIC_DERMATITIS');
    }

    const result = await prisma.formularyDrug.updateMany({
      where: {
        drugName: {
          contains: drugName,
          mode: 'insensitive'
        }
      },
      data: {
        approvedIndications: indications
      }
    });

    if (result.count > 0) {
      console.log(`✓ Updated ${drugName}: ${indications.join(', ')} (${result.count} rows)`);
    }
  }

  // Update atopic dermatitis-only drugs
  for (const drugName of atopicDermatitisDrugs) {
    if (!psoriasisDrugs.includes(drugName)) {
      const result = await prisma.formularyDrug.updateMany({
        where: {
          drugName: {
            contains: drugName,
            mode: 'insensitive'
          }
        },
        data: {
          approvedIndications: ['ATOPIC_DERMATITIS']
        }
      });

      if (result.count > 0) {
        console.log(`✓ Updated ${drugName}: ATOPIC_DERMATITIS (${result.count} rows)`);
      }
    }
  }

  console.log('\n✓ Done! Restart your dev server and reassess.');
}

fixApprovedIndications()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
