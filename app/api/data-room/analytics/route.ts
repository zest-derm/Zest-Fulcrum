import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Fetch all assessments with related data
    const assessments = await prisma.assessment.findMany({
      include: {
        provider: true,
        patient: true,
        recommendations: {
          include: {
            providerFeedback: true,
          },
        },
        providerFeedback: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate overall metrics
    const totalAssessments = assessments.length;
    const assessmentsWithRecommendations = assessments.filter(a => a.recommendations.length > 0);
    const totalRecommendations = assessments.reduce((sum, a) => sum + a.recommendations.length, 0);

    // Track accepted vs declined recommendations
    const acceptedRecommendations = assessments.flatMap(a =>
      a.recommendations.filter(r => r.status === 'ACCEPTED')
    );
    const declinedRecommendations = assessments.flatMap(a =>
      a.recommendations.filter(r => r.status === 'REJECTED')
    );

    // Calculate acceptance rates by provider
    const providerStats = new Map();

    assessments.forEach(assessment => {
      const providerName = assessment.provider?.name || 'Unknown';

      if (!providerStats.has(providerName)) {
        providerStats.set(providerName, {
          name: providerName,
          totalAssessments: 0,
          totalRecommendations: 0,
          acceptedCount: 0,
          declinedCount: 0,
          acceptanceRate: 0,
          byDiagnosis: {},
          byRemission: { remission: { accepted: 0, total: 0 }, active: { accepted: 0, total: 0 } },
        });
      }

      const stats = providerStats.get(providerName);
      stats.totalAssessments++;
      stats.totalRecommendations += assessment.recommendations.length;

      // Track by remission status
      const isRemission = assessment.dlqiScore !== null && assessment.dlqiScore <= 5;
      const remissionKey = isRemission ? 'remission' : 'active';

      assessment.recommendations.forEach(rec => {
        if (rec.status === 'ACCEPTED') {
          stats.acceptedCount++;
          stats.byRemission[remissionKey].accepted++;
        } else if (rec.status === 'REJECTED') {
          stats.declinedCount++;
        }
        stats.byRemission[remissionKey].total++;

        // Track by diagnosis
        const diagnosis = assessment.diagnosis || 'UNKNOWN';
        if (!stats.byDiagnosis[diagnosis]) {
          stats.byDiagnosis[diagnosis] = { accepted: 0, total: 0 };
        }
        stats.byDiagnosis[diagnosis].total++;
        if (rec.status === 'ACCEPTED') {
          stats.byDiagnosis[diagnosis].accepted++;
        }
      });

      // Calculate acceptance rate
      if (stats.totalRecommendations > 0) {
        stats.acceptanceRate = (stats.acceptedCount / stats.totalRecommendations) * 100;
      }
    });

    // Calculate acceptance rates by diagnosis
    const diagnosisStats = new Map();

    assessments.forEach(assessment => {
      const diagnosis = assessment.diagnosis || 'UNKNOWN';

      if (!diagnosisStats.has(diagnosis)) {
        diagnosisStats.set(diagnosis, {
          diagnosis,
          totalAssessments: 0,
          totalRecommendations: 0,
          acceptedCount: 0,
          declinedCount: 0,
          acceptanceRate: 0,
          byRemission: { remission: { accepted: 0, total: 0 }, active: { accepted: 0, total: 0 } },
        });
      }

      const stats = diagnosisStats.get(diagnosis);
      stats.totalAssessments++;
      stats.totalRecommendations += assessment.recommendations.length;

      const isRemission = assessment.dlqiScore !== null && assessment.dlqiScore <= 5;
      const remissionKey = isRemission ? 'remission' : 'active';

      assessment.recommendations.forEach(rec => {
        if (rec.status === 'ACCEPTED') {
          stats.acceptedCount++;
          stats.byRemission[remissionKey].accepted++;
        } else if (rec.status === 'REJECTED') {
          stats.declinedCount++;
        }
        stats.byRemission[remissionKey].total++;
      });

      if (stats.totalRecommendations > 0) {
        stats.acceptanceRate = (stats.acceptedCount / stats.totalRecommendations) * 100;
      }
    });

    // Calculate overall acceptance rate
    const overallAcceptanceRate = totalRecommendations > 0
      ? (acceptedRecommendations.length / totalRecommendations) * 100
      : 0;

    // Calculate total savings
    const totalPotentialSavings = acceptedRecommendations.reduce(
      (sum, rec) => sum + (rec.annualSavings || 0),
      0
    );

    // Prepare individual assessment details for search
    const assessmentDetails = assessments.map(assessment => ({
      id: assessment.id,
      mrn: assessment.mrn,
      providerName: assessment.provider?.name || 'Unknown',
      providerId: assessment.providerId,
      diagnosis: assessment.diagnosis,
      hasPsoriaticArthritis: assessment.hasPsoriaticArthritis,
      dlqiScore: assessment.dlqiScore,
      monthsStable: assessment.monthsStable,
      isRemission: assessment.dlqiScore !== null && assessment.dlqiScore <= 5,
      createdAt: assessment.createdAt,
      patientName: assessment.patient
        ? `${assessment.patient.firstName} ${assessment.patient.lastName}`.trim() || null
        : null,
      recommendations: assessment.recommendations.map(rec => ({
        id: rec.id,
        rank: rec.rank,
        type: rec.type,
        drugName: rec.drugName,
        status: rec.status,
        annualSavings: rec.annualSavings,
        currentAnnualCost: rec.currentAnnualCost,
        recommendedAnnualCost: rec.recommendedAnnualCost,
        savingsPercent: rec.savingsPercent,
        contraindicated: rec.contraindicated,
        decidedAt: rec.decidedAt,
      })),
      feedback: assessment.providerFeedback.map(fb => ({
        id: fb.id,
        selectedRank: fb.selectedRank,
        reasonForChoice: fb.reasonForChoice,
        reasonAgainstFirst: fb.reasonAgainstFirst,
        reasonForDeclineAll: fb.reasonForDeclineAll,
        alternativePlan: fb.alternativePlan,
      })),
    }));

    return NextResponse.json({
      summary: {
        totalAssessments,
        totalRecommendations,
        acceptedCount: acceptedRecommendations.length,
        declinedCount: declinedRecommendations.length,
        overallAcceptanceRate,
        totalPotentialSavings,
      },
      byProvider: Array.from(providerStats.values()).sort((a, b) =>
        b.totalAssessments - a.totalAssessments
      ),
      byDiagnosis: Array.from(diagnosisStats.values()).sort((a, b) =>
        b.totalAssessments - a.totalAssessments
      ),
      assessmentDetails,
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
