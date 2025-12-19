import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateRecommendations } from '@/lib/decision-engine-fallback';
import { generateLLMRecommendations } from '@/lib/llm-decision-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      providerId,
      patientId,
      planId,
      medicationType,
      currentBiologic,
      diagnosis,
      hasPsoriaticArthritis,
      contraindications,
      isStable,
      bmi,
      failedTherapies,
      assessmentStartedAt,
    } = body;

    // Validate required fields
    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    if (!planId) {
      return NextResponse.json(
        { error: 'Partner is required' },
        { status: 400 }
      );
    }

    // Convert isStable boolean to DLQI score for database compatibility
    // Stable = DLQI 2 (small impact), Unstable = DLQI 8 (moderate impact)
    const dlqiScore = isStable ? 2 : 8;

    // Create assessment
    const assessment = await prisma.assessment.create({
      data: {
        providerId: providerId,
        patientId: patientId || null,
        planId: planId,
        medicationType: medicationType || 'biologic',
        diagnosis,
        hasPsoriaticArthritis: hasPsoriaticArthritis || false,
        dlqiScore: dlqiScore,
        bmi: bmi || null,
        // Store current biologic info for PHI-free assessments
        currentBiologicName: currentBiologic?.drugName || null,
        currentBiologicDose: currentBiologic?.dose || null,
        currentBiologicFrequency: currentBiologic?.frequency || null,
        assessmentStartedAt: assessmentStartedAt ? new Date(assessmentStartedAt) : null,
      },
    });

    // Generate recommendations using LLM if available, with fallback to rule-based
    const useLLM = !!process.env.ANTHROPIC_API_KEY;
    let result;

    const assessmentInput = {
      patientId: patientId || assessment.id, // Use assessment ID if no patient
      planId,
      medicationType: medicationType || 'biologic',
      currentBiologic,
      diagnosis,
      hasPsoriaticArthritis: hasPsoriaticArthritis || false,
      contraindications: contraindications || [],
      failedTherapies: failedTherapies || [],
      isStable,
      dlqiScore: dlqiScore,
      bmi: bmi || null,
    };

    if (useLLM) {
      try {
        console.log('Attempting LLM-based recommendations...');
        result = await generateLLMRecommendations(assessmentInput);
        console.log(`LLM generated ${result.recommendations.length} recommendations`);
      } catch (error: any) {
        console.error('LLM recommendations failed, falling back to rule-based:', error.message);
        result = await generateRecommendations(assessmentInput);
        console.log(`Rule-based generated ${result.recommendations.length} recommendations`);
      }
    } else {
      result = await generateRecommendations(assessmentInput);
    }

    // Save recommendations
    await Promise.all(
      result.recommendations.map((rec) => {
        // Filter out undefined values to avoid Prisma validation errors
        const data: any = {
          assessmentId: assessment.id,
          patientId: patientId || null,
          // Simplified system no longer tracks these fields
          isStable: null,
          isFormularyOptimal: null,
          quadrant: null,
          rank: rec.rank,
          type: rec.type,
          drugName: rec.drugName,
          rationale: rec.rationale,
          evidenceSources: rec.evidenceSources || [],
          contraindicated: rec.contraindicated ?? false,
        };

        // Only add optional fields if they're defined
        if (rec.newDose !== undefined) data.newDose = rec.newDose;
        if (rec.newFrequency !== undefined) data.newFrequency = rec.newFrequency;
        if (rec.currentAnnualCost !== undefined) data.currentAnnualCost = rec.currentAnnualCost;
        if (rec.recommendedAnnualCost !== undefined) data.recommendedAnnualCost = rec.recommendedAnnualCost;
        if (rec.annualSavings !== undefined) data.annualSavings = rec.annualSavings;
        if (rec.savingsPercent !== undefined) data.savingsPercent = rec.savingsPercent;
        if (rec.currentMonthlyOOP !== undefined) data.currentMonthlyOOP = rec.currentMonthlyOOP;
        if (rec.recommendedMonthlyOOP !== undefined) data.recommendedMonthlyOOP = rec.recommendedMonthlyOOP;
        if (rec.monitoringPlan !== undefined) data.monitoringPlan = rec.monitoringPlan;
        if (rec.tier !== undefined) data.tier = rec.tier;
        if (rec.requiresPA !== undefined) data.requiresPA = rec.requiresPA;
        if (rec.contraindicationReason !== undefined) data.contraindicationReason = rec.contraindicationReason;

        return prisma.recommendation.create({ data });
      })
    );

    return NextResponse.json({
      success: true,
      assessmentId: assessment.id,
    });
  } catch (error: any) {
    console.error('Error creating assessment:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
