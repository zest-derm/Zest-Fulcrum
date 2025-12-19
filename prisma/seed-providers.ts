import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding providers...');

  // Only create providers if they don't exist
  const providers = ['Rachel Day', 'Nadia Esmaeili', 'Deanna Moore', 'Rochelle Lamb', 'Olivia Deitcher'];

  for (const name of providers) {
    const existing = await prisma.provider.findUnique({
      where: { name },
    });

    if (!existing) {
      await prisma.provider.create({
        data: { name },
      });
      console.log(`✓ Created provider: ${name}`);
    } else {
      console.log(`- Provider already exists: ${name}`);
    }
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
