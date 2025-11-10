const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFormulary() {
  const drugs = await prisma.formularyDrug.findMany({
    select: {
      drugName: true,
      genericName: true,
      drugClass: true,
      approvedIndications: true,
    },
    distinct: ['drugName'],
    orderBy: { drugName: 'asc' },
  });

  console.log('Current formulary drugs:\n');
  drugs.forEach(drug => {
    const indications = drug.approvedIndications.length > 0
      ? drug.approvedIndications.join(', ')
      : '(empty - needs fix)';
    console.log(`- ${drug.drugName} (${drug.genericName}) - ${drug.drugClass}`);
    console.log(`  Indications: ${indications}\n`);
  });

  await prisma.$disconnect();
}

checkFormulary();
