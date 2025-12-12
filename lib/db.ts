import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Explicitly configure datasource only if DATABASE_URL is available
// This allows build to succeed while ensuring runtime has correct config
const prismaConfig = process.env.DATABASE_URL
  ? {
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    }
  : {};

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaConfig);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
