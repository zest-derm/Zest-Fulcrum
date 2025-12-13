import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL format:', process.env.DATABASE_URL?.substring(0, 30) + '...');

    // Test 1: Simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;

    // Test 2: Check if we can access tables
    const patientCount = await prisma.patient.count();

    return NextResponse.json({
      success: true,
      checks: {
        envVarExists: !!process.env.DATABASE_URL,
        simpleQuery: result,
        patientCount: patientCount,
      },
      message: 'Database connection successful'
    });
  } catch (error: any) {
    console.error('Database connection error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      envVarExists: !!process.env.DATABASE_URL,
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
