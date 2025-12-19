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
      selectedTier,
      assessmentTimeMinutes,
      formularyAccurate,
      additionalFeedback,
      yearlyRecommendationCost,
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

    // Fetch MRN from assessment (required field in assessment now)
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { mrn: true },
    });

    if (!assessment || !assessment.mrn) {
      return NextResponse.json(
        { error: 'Assessment not found or MRN missing' },
        { status: 400 }
      );
    }

    // Update recommendation status based on provider decision
    if (recommendationId) {
      // Provider accepted this specific recommendation
      await prisma.recommendation.update({
        where: { id: recommendationId },
        data: {
          status: 'ACCEPTED',
          decidedAt: new Date(),
        },
      });

      // Mark all other recommendations for this assessment as REJECTED
      await prisma.recommendation.updateMany({
        where: {
          assessmentId,
          id: { not: recommendationId },
        },
        data: {
          status: 'REJECTED',
          decidedAt: new Date(),
        },
      });
    } else {
      // Provider declined all recommendations
      await prisma.recommendation.updateMany({
        where: { assessmentId },
        data: {
          status: 'REJECTED',
          decidedAt: new Date(),
          rejectionReason: reasonForDeclineAll || 'All recommendations declined',
        },
      });
    }

    // Create provider feedback
    const feedback = await prisma.providerFeedback.create({
      data: {
        assessmentId,
        recommendationId: recommendationId || null,
        mrn: assessment.mrn,
        providerId: providerId || null,
        selectedRank: selectedRank || null,
        selectedTier: selectedTier || null,
        assessmentTimeMinutes: assessmentTimeMinutes || null,
        formularyAccurate: formularyAccurate !== null && formularyAccurate !== undefined ? formularyAccurate : null,
        additionalFeedback: additionalFeedback || null,
        yearlyRecommendationCost: yearlyRecommendationCost || null,
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
