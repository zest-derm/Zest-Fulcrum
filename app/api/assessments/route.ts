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
      result.recommendations.map((rec) =>
        prisma.recommendation.create({
          data: {
            assessmentId: assessment.id,
            patientId,
            isStable: result.isStable,
            isFormularyOptimal: result.isFormularyOptimal,
            quadrant: result.quadrant,
            rank: rec.rank,
            type: rec.type,
            drugName: rec.drugName,
            newDose: rec.newDose,
            newFrequency: rec.newFrequency,
            currentAnnualCost: rec.currentAnnualCost,
            recommendedAnnualCost: rec.recommendedAnnualCost,
            annualSavings: rec.annualSavings,
            savingsPercent: rec.savingsPercent,
            currentMonthlyOOP: rec.currentMonthlyOOP,
            recommendedMonthlyOOP: rec.recommendedMonthlyOOP,
            rationale: rec.rationale,
            evidenceSources: rec.evidenceSources,
            monitoringPlan: rec.monitoringPlan,
            tier: rec.tier,
            requiresPA: rec.requiresPA,
            contraindicated: rec.contraindicated,
            contraindicationReason: rec.contraindicationReason,
          },
        })
      )
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
