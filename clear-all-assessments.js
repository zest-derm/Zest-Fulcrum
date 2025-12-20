const { PrismaClient } = require('@prisma/client');

async function clearDatabase(databaseUrl, label) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    console.log(`\n🗑️  Clearing ${label}...`);

    // Delete in order due to foreign keys
    const deletedFeedback = await prisma.providerFeedback.deleteMany({});
    console.log(`   ✓ Deleted ${deletedFeedback.count} feedback records`);

    const deletedRecs = await prisma.recommendation.deleteMany({});
    console.log(`   ✓ Deleted ${deletedRecs.count} recommendations`);

    const deletedAssessments = await prisma.assessment.deleteMany({});
    console.log(`   ✓ Deleted ${deletedAssessments.count} assessments`);

    console.log(`✅ ${label} cleared!`);
  } catch (error) {
    console.error(`❌ Error clearing ${label}:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  // Get database URLs from environment
  const localDb = process.env.DATABASE_URL;
  const prodDb = process.env.PROD_DATABASE_URL;

  if (!localDb) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  // Clear local database
  await clearDatabase(localDb, 'Local Database');

  // Clear production database if provided
  if (prodDb) {
    await clearDatabase(prodDb, 'Production Database (Supabase)');
  } else {
    console.log('\n⚠️  PROD_DATABASE_URL not set. Skipping production database.');
    console.log('To clear production, run:');
    console.log('PROD_DATABASE_URL="your-supabase-url" node clear-all-assessments.js');
  }

  console.log('\n✨ Done!');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
