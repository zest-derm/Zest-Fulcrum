import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assessmentId,
      recommendationId,
      mrn,
      providerId,
      selectedRank,
      reasonForChoice,
      reasonAgainstFirst,
      reasonForDeclineAll,
      alternativePlan,
    } = body;

    // Validate required fields
    if (!assessmentId) {
      return NextResponse.json(
        { error: 'Assessment ID is required' },
        { status: 400 }
      );
    }

    if (!mrn) {
      return NextResponse.json(
        { error: 'MRN is required' },
        { status: 400 }
      );
    }

    // Create provider feedback
    const feedback = await prisma.providerFeedback.create({
      data: {
        assessmentId,
        recommendationId: recommendationId || null,
        mrn,
        providerId: providerId || null,
        selectedRank: selectedRank || null,
        reasonForChoice: reasonForChoice || null,
        reasonAgainstFirst: reasonAgainstFirst || null,
        reasonForDeclineAll: reasonForDeclineAll || null,
        alternativePlan: alternativePlan || null,
      },
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    });
  } catch (error: any) {
    console.error('Error saving provider feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
