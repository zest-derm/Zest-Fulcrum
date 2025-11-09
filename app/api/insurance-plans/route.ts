import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const plans = await prisma.insurancePlan.findMany({
      select: {
        id: true,
        planName: true,
        payerName: true,
      },
      orderBy: { planName: 'asc' },
    });

    return NextResponse.json(plans);
  } catch (error: any) {
    console.error('Error fetching insurance plans:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planName, payerName } = body;

    if (!planName || !payerName) {
      return NextResponse.json(
        { error: 'Plan name and payer name are required' },
        { status: 400 }
      );
    }

    const plan = await prisma.insurancePlan.create({
      data: {
        planName,
        payerName,
        formularyVersion: new Date().toISOString().split('T')[0],
      },
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('Error creating insurance plan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
