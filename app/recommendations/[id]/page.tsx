import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AlertCircle, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { Suspense } from 'react';
import ContraindicatedDrugsToggle from './ContraindicatedDrugsToggle';
import RecommendationFeedback from './RecommendationFeedback';
import FormularyReference from './FormularyReference';

interface PageProps {
  params: { id: string };
}

export default async function RecommendationsPage({ params }: PageProps) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: {
      patient: {
        include: {
          currentBiologics: true,
          plan: {
            include: {
              formularyDrugs: {
                orderBy: [
                  { tier: 'asc' },
                  { requiresPA: 'asc' },
                ],
              },
            },
          },
          contraindications: true,
        },
      },
      plan: true,  // Include plan for PHI-free assessments
      recommendations: {
        orderBy: { rank: 'asc' },
      },
    },
  });

  if (!assessment) {
    notFound();
  }

  // Resolve formulary drugs (same logic as decision engine)
  // Priority: assessment.planId > patient.planId > resolved formularyPlanName
  let effectivePlanId = assessment.planId || assessment.patient?.planId;
  if (!effectivePlanId && assessment.patient?.formularyPlanName) {
    const planByName = await prisma.insurancePlan.findFirst({
      where: { planName: assessment.patient.formularyPlanName },
    });
    if (planByName) {
      effectivePlanId = planByName.id;
    }
  }

  // Fetch formulary drugs from the most recent upload for the effective plan
  const mostRecentUpload = effectivePlanId
    ? await prisma.uploadLog.findFirst({
        where: {
          uploadType: 'FORMULARY',
          planId: effectivePlanId,
        },
        orderBy: { uploadedAt: 'desc' },
        select: { id: true },
      })
    : null;

  const fetchedFormularyDrugs = mostRecentUpload && effectivePlanId
    ? await prisma.formularyDrug.findMany({
        where: {
          planId: effectivePlanId,
          uploadLogId: mostRecentUpload.id,
        },
        orderBy: [
          { tier: 'asc' },
          { requiresPA: 'asc' },
        ],
      })
    : [];

  // Comprehensive contraindication checking with reasons
  const checkContraindications = (drugs: any[], contraindications: any[]) => {
    if (contraindications.length === 0) {
      return { safe: drugs, contraindicated: [] };
    }

    const safe: any[] = [];
    const contraindicated: any[] = [];

    for (const drug of drugs) {
      const normalizedDrugClass = drug.drugClass?.toUpperCase().replace(/\s+/g, '_') || '';
      const reasons: Array<{ type: string; severity: 'ABSOLUTE' | 'RELATIVE'; reason: string; details?: string }> = [];

      for (const ci of contraindications) {
        const ciType = ci.type;

        // SILIQ (BRODALUMAB) - BLACK BOX WARNING
        if (drug.drugName?.toLowerCase().includes('siliq') || drug.drugName?.toLowerCase().includes('brodalumab')) {
          if (ciType === 'DEPRESSION_SUICIDAL_IDEATION') {
            reasons.push({
              type: ciType,
              severity: 'ABSOLUTE',
              reason: 'BLACK BOX WARNING: Siliq (brodalumab) is contraindicated in patients with history of depression or suicidal ideation. Associated with increased risk of suicidal thoughts and behavior.',
              details: ci.details
            });
          }
        }

        // TNF INHIBITORS
        if (normalizedDrugClass.includes('TNF')) {
          if (ciType === 'HEART_FAILURE') {
            reasons.push({
              type: ciType,
              severity: 'ABSOLUTE',
              reason: 'BLACK BOX WARNING: TNF inhibitors can worsen heart failure and increase mortality in patients with moderate to severe heart failure (NYHA Class III/IV).',
              details: ci.details
            });
          }
          if (ciType === 'MULTIPLE_SCLEROSIS' || ciType === 'DEMYELINATING_DISEASE') {
            reasons.push({
              type: ciType,
              severity: 'ABSOLUTE',
              reason: 'TNF inhibitors can exacerbate demyelinating diseases including multiple sclerosis. Risk of new onset or worsening neurological symptoms.',
              details: ci.details
            });
          }
          if (ciType === 'MALIGNANCY_LYMPHOMA' || ciType === 'LYMPHOMA' || ciType === 'MALIGNANCY') {
            reasons.push({
              type: ciType,
              severity: 'RELATIVE',
              reason: 'BLACK BOX WARNING: TNF inhibitors may increase risk of lymphoma and other malignancies, especially in children and adolescents. History of malignancy requires oncology consultation for risk/benefit assessment.',
              details: ci.details
            });
          }
          if (ciType === 'HEPATITIS_B_C' || ciType === 'HEPATITIS_B') {
            reasons.push({
              type: ciType,
              severity: 'RELATIVE',
              reason: 'BLACK BOX WARNING: TNF inhibitors can cause Hepatitis B reactivation, potentially fatal. Requires antiviral prophylaxis and close monitoring. Screen for HBV before starting.',
              details: ci.details
            });
          }
          if (ciType === 'TUBERCULOSIS' || ciType === 'ACTIVE_TUBERCULOSIS' || ciType === 'LATENT_TUBERCULOSIS') {
            const isActive = ciType === 'TUBERCULOSIS' || ciType === 'ACTIVE_TUBERCULOSIS';
            reasons.push({
              type: ciType,
              severity: isActive ? 'ABSOLUTE' : 'RELATIVE',
              reason: isActive
                ? 'BLACK BOX WARNING: Active TB must be treated before starting TNF inhibitor. Risk of TB reactivation and disseminated disease.'
                : 'BLACK BOX WARNING: Latent TB requires prophylactic treatment before starting TNF inhibitor. High risk of reactivation with disseminated or extrapulmonary TB.',
              details: ci.details
            });
          }
        }

        // JAK INHIBITORS
        if (normalizedDrugClass.includes('JAK') || normalizedDrugClass.includes('TYK2')) {
          if (ciType === 'THROMBOSIS_VTE' || ciType === 'THROMBOSIS' || ciType === 'VENOUS_THROMBOEMBOLISM') {
            reasons.push({
              type: ciType,
              severity: 'ABSOLUTE',
              reason: 'BLACK BOX WARNING: JAK inhibitors significantly increase risk of venous thromboembolism (VTE) including pulmonary embolism and deep vein thrombosis. Contraindicated in patients with history of blood clots.',
              details: ci.details
            });
          }
          if (ciType === 'MALIGNANCY_LYMPHOMA' || ciType === 'LYMPHOMA' || ciType === 'MALIGNANCY') {
            reasons.push({
              type: ciType,
              severity: 'RELATIVE',
              reason: 'BLACK BOX WARNING: JAK inhibitors increase risk of malignancies including lymphoma and lung cancer. History of malignancy requires oncology consultation.',
              details: ci.details
            });
          }
          if (ciType === 'CARDIOVASCULAR_DISEASE') {
            reasons.push({
              type: ciType,
              severity: 'RELATIVE',
              reason: 'BLACK BOX WARNING: JAK inhibitors increase risk of major adverse cardiovascular events (MACE) including heart attack and stroke, especially in patients >50 with cardiovascular risk factors. Monitor closely.',
              details: ci.details
            });
          }
        }

        // IL-17 INHIBITORS (COSENTYX, TALTZ, SILIQ)
        if (normalizedDrugClass.includes('IL17') || normalizedDrugClass.includes('IL-17')) {
          if (ciType === 'INFLAMMATORY_BOWEL_DISEASE') {
            reasons.push({
              type: ciType,
              severity: 'RELATIVE',
              reason: 'IL-17 inhibitors can worsen or trigger inflammatory bowel disease (Crohn\'s disease, ulcerative colitis). Requires GI consultation and close monitoring.',
              details: ci.details
            });
          }
        }

        // ALL BIOLOGICS - SERIOUS INFECTIONS
        if (ciType === 'ACTIVE_INFECTION') {
          reasons.push({
            type: ciType,
            severity: 'ABSOLUTE',
            reason: 'Active infection must be treated and resolved before starting any biologic therapy. Biologics suppress immune function and can worsen infections.',
            details: ci.details
          });
        }

        // ALL BIOLOGICS - PREGNANCY
        if (ciType === 'PREGNANCY') {
          reasons.push({
            type: ciType,
            severity: 'RELATIVE',
            reason: 'Pregnancy requires careful risk/benefit assessment. Some biologics are safer than others (e.g., Certolizumab has less placental transfer). Consult maternal-fetal medicine.',
            details: ci.details
          });
        }

        // ALL BIOLOGICS - TUBERCULOSIS SCREENING
        if (ciType === 'TUBERCULOSIS' || ciType === 'ACTIVE_TUBERCULOSIS' || ciType === 'LATENT_TUBERCULOSIS') {
          // Only add for non-TNF biologics (TNF already handled above)
          if (!normalizedDrugClass.includes('TNF')) {
            const isActive = ciType === 'TUBERCULOSIS' || ciType === 'ACTIVE_TUBERCULOSIS';
            reasons.push({
              type: ciType,
              severity: isActive ? 'ABSOLUTE' : 'RELATIVE',
              reason: isActive
                ? 'Active TB must be treated before starting any biologic. Biologics increase risk of TB reactivation.'
                : 'Latent TB should be treated before starting biologic therapy. Monitor for TB reactivation.',
              details: ci.details
            });
          }
        }

        // ALL BIOLOGICS - HEPATITIS B/C
        if (ciType === 'HEPATITIS_B_C' || ciType === 'HEPATITIS_B') {
          // Only add for non-TNF biologics (TNF already handled above with stronger warning)
          if (!normalizedDrugClass.includes('TNF')) {
            reasons.push({
              type: ciType,
              severity: 'RELATIVE',
              reason: 'Active, untreated Hepatitis B or C requires treatment before starting biologic. Risk of viral reactivation. Screen for HBV/HCV before starting therapy.',
              details: ci.details
            });
          }
        }
      }

      // Categorize
      if (reasons.length === 0) {
        safe.push(drug);
      } else {
        contraindicated.push({ drug, reasons });
      }
    }

    return { safe, contraindicated };
  };

  // Filter drugs by diagnosis indication
  const filterByDiagnosis = (drugs: any[], diagnosis: string) => {
    return drugs.filter(drug => {
      // If no indications specified, include it (for backward compatibility)
      if (!drug.fdaIndications || drug.fdaIndications.length === 0) {
        return true;
      }
      // Check if the diagnosis matches any FDA indication (case-insensitive, partial match)
      // Handle both "PSORIASIS" (enum) and "Psoriasis" (data) formats
      // Also handle abbreviations like "PsA" for Psoriatic Arthritis
      const diagnosisLower = diagnosis.toLowerCase().replace(/_/g, ' ');

      return drug.fdaIndications.some((indication: string) => {
        const indicationLower = indication.toLowerCase().replace(/_/g, ' ');
        // Exact match OR partial match (e.g., "psoriasis" matches "psoriatic arthritis")
        return indicationLower.includes(diagnosisLower) || diagnosisLower.includes(indicationLower);
      });
    });
  };

  // Get safe formulary drugs (filtered for diagnosis AND contraindications)
  // Use fetchedFormularyDrugs from the plan resolution above
  const diagnosisAppropriateDrugs = filterByDiagnosis(
    fetchedFormularyDrugs,
    assessment.diagnosis
  );
  const { safe: safeFormularyDrugs, contraindicated: contraindicatedFormularyDrugs } = checkContraindications(
    diagnosisAppropriateDrugs,
    assessment.patient?.contraindications || []
  );

  const formatCurrency = (amount: any) => {
    if (amount === null || amount === undefined) return 'N/A';
    // Handle Prisma Decimal type
    const numAmount = typeof amount === 'object' && 'toNumber' in amount ? amount.toNumber() : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  // Extract topical medication from rationale for CEASE_BIOLOGIC recommendations
  const extractTopicalFromRationale = (rationale: string): string => {
    const topicals = ['Zoryve', 'Opzelura', 'tacrolimus', 'roflumilast', 'ruxolitinib'];
    for (const topical of topicals) {
      if (rationale.toLowerCase().includes(topical.toLowerCase())) {
        // Extract the medication name and any surrounding context (like "roflumilast cream")
        const regex = new RegExp(`(${topical}[^.,;)]*(?:cream|ointment|gel)?)`, 'i');
        const match = rationale.match(regex);
        if (match) {
          return match[1].trim();
        }
        return topical;
      }
    }
    return 'Non-biologic therapy';
  };

  // Bold medication names in rationale text
  const boldMedications = (text: string) => {
    const medications = ['Zoryve', 'Opzelura', 'tacrolimus', 'roflumilast', 'ruxolitinib'];
    let result = text;
    for (const med of medications) {
      const regex = new RegExp(`(${med}[^.,;)]*(?:cream|ointment|gel)?)`, 'gi');
      result = result.replace(regex, '<strong>$1</strong>');
    }
    return result;
  };

  // Get current biologic from patient record OR from assessment (for PHI-free assessments)
  const currentBiologic = assessment.patient?.currentBiologics?.[0] ||
    (assessment.currentBiologicName ? {
      drugName: assessment.currentBiologicName,
      dose: assessment.currentBiologicDose,
      frequency: assessment.currentBiologicFrequency,
    } : null);

  const quadrantLabel = assessment.recommendations[0]?.quadrant?.replace(/_/g, ' ').toUpperCase() || 'N/A';

  // Find current drug's tier from formulary
  const currentDrugTier = currentBiologic
    ? fetchedFormularyDrugs.find(
        drug => drug.drugName.toLowerCase() === currentBiologic.drugName.toLowerCase()
      )?.tier
    : undefined;

  // Get plan name and formulary version for display
  const planName = assessment.plan?.planName || assessment.patient?.plan?.planName || assessment.patient?.formularyPlanName || 'Unknown';
  const formularyVersion = assessment.plan?.formularyVersion || assessment.patient?.plan?.formularyVersion || null;
  const formularyReference = formularyVersion ? `${planName} - ${formularyVersion}` : planName;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2">
          {assessment.patient
            ? `Recommendations for ${assessment.patient.firstName} ${assessment.patient.lastName}`
            : 'Clinical Recommendations (PHI-Free Assessment)'
          }
        </h1>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span>Plan: {planName}</span>
          {formularyVersion && (
            <>
              <span>•</span>
              <span>Formulary: {formularyVersion}</span>
            </>
          )}
          <span>•</span>
          <span>
            Current: {currentBiologic?.drugName || 'None'} {currentBiologic?.dose} {currentBiologic?.frequency}
            {currentBiologic && currentDrugTier && (
              <> • Tier {currentDrugTier}</>
            )}
            {currentBiologic && assessment.recommendations[0] && assessment.recommendations[0].isFormularyOptimal !== null && (
              <> • <span className={assessment.recommendations[0].isFormularyOptimal ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                {assessment.recommendations[0].isFormularyOptimal ? 'Optimal' : 'Suboptimal'}
              </span></>
            )}
          </span>
        </div>
      </div>

      {/* Formulary Reference Banner */}
      <div className="card mb-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">Formulary Reference</h3>
            <p className="text-sm text-blue-800">
              The following recommendations are based on the <strong>{formularyReference}</strong> formulary.
              All tier placements, cost calculations, and coverage determinations reflect this specific formulary version.
            </p>
          </div>
        </div>
      </div>

      {/* Assessment Info */}
      {quadrantLabel !== 'N/A' && (
        <div className="card mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="mb-2">Classification (Legacy)</h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-primary-100 text-primary-800 font-medium text-sm">
                  {quadrantLabel}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>Stability:</strong>{' '}
                  {assessment.recommendations.length > 0 && assessment.recommendations[0]?.isStable !== null ? (
                    assessment.recommendations[0]?.isStable ? (
                      <span className="text-green-700">Stable</span>
                    ) : (
                      <span className="text-amber-700">Unstable</span>
                    )
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}{' '}
                  (DLQI: {assessment.dlqiScore})
                </p>
                <p>
                  <strong>Formulary Status:</strong>{' '}
                  {assessment.recommendations[0]?.isFormularyOptimal !== null ? (
                    assessment.recommendations[0]?.isFormularyOptimal ? (
                      <span className="text-green-700">Optimal</span>
                    ) : (
                      <span className="text-amber-700">Suboptimal</span>
                    )
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Assessed on</p>
              <p className="text-sm font-medium">
                {new Date(assessment.assessedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-6">
        {assessment.recommendations.map((rec, idx) => {
          const isContraindicated = rec.contraindicated;
          const hasSavings = rec.annualSavings && rec.annualSavings.toNumber() > 0;

          return (
            <div
              key={rec.id}
              className={`card ${
                idx === 0 && !isContraindicated
                  ? 'border-2 border-primary-500 bg-primary-50/30'
                  : isContraindicated
                  ? 'border-2 border-red-300 bg-red-50/30'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">
                    {rec.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3>{rec.drugName}</h3>
                      {idx === 0 && !isContraindicated && (
                        <span className="px-2 py-0.5 rounded text-xs bg-primary-600 text-white font-medium">
                          RECOMMENDED
                        </span>
                      )}
                      {isContraindicated && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-600 text-white font-medium">
                          CONTRAINDICATED
                        </span>
                      )}
                    </div>
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm font-semibold text-blue-900">
                        {rec.type === 'CEASE_BIOLOGIC' ? (
                          <>Recommended Alternative: {extractTopicalFromRationale(rec.rationale)}</>
                        ) : (
                          <>Recommended Dosing: {rec.newDose} {rec.newFrequency}</>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {rec.type.replace(/_/g, ' ')} • Tier {rec.tier || 'N/A'}
                      {rec.requiresPA && ` • Prior Auth Required`}
                    </p>
                  </div>
                </div>
              </div>

              {isContraindicated && rec.contraindicationReason && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{rec.contraindicationReason}</p>
                </div>
              )}

              {/* Cost Savings */}
              {hasSavings && !isContraindicated && (
                <div className="grid md:grid-cols-2 gap-4 mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <div className="flex items-center text-green-800 mb-2">
                      <DollarSign className="w-5 h-5 mr-1" />
                      <h4 className="font-semibold text-sm">Annual Cost Impact</h4>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current:</span>
                        <span className="font-medium">{formatCurrency(rec.currentAnnualCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recommended:</span>
                        <span className="font-medium">{formatCurrency(rec.recommendedAnnualCost)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-green-300">
                        <span className="text-green-800 font-semibold">Savings:</span>
                        <span className="text-green-800 font-bold">
                          {formatCurrency(rec.annualSavings)} ({rec.savingsPercent?.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center text-green-800 mb-2">
                      <TrendingDown className="w-5 h-5 mr-1" />
                      <h4 className="font-semibold text-sm">Patient Out-of-Pocket</h4>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current (monthly):</span>
                        <span className="font-medium">{formatCurrency(rec.currentMonthlyOOP)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recommended:</span>
                        <span className="font-medium">{formatCurrency(rec.recommendedMonthlyOOP)}</span>
                      </div>
                      {rec.currentMonthlyOOP && rec.recommendedMonthlyOOP && (
                        <div className="flex justify-between pt-2 border-t border-green-300">
                          <span className="text-green-800 font-semibold">Savings:</span>
                          <span className="text-green-800 font-bold">
                            {formatCurrency(
                              (typeof rec.currentMonthlyOOP === 'object' && 'toNumber' in rec.currentMonthlyOOP
                                ? rec.currentMonthlyOOP.toNumber()
                                : rec.currentMonthlyOOP || 0) -
                              (typeof rec.recommendedMonthlyOOP === 'object' && 'toNumber' in rec.recommendedMonthlyOOP
                                ? rec.recommendedMonthlyOOP.toNumber()
                                : rec.recommendedMonthlyOOP || 0)
                            )}/mo
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Rationale */}
              <div className="mb-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  Clinical Rationale
                </h4>
                <p className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: boldMedications(rec.rationale) }} />
              </div>

              {/* Monitoring Plan */}
              {rec.monitoringPlan && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-sm mb-1 text-blue-900">Monitoring Plan</h4>
                  <p className="text-sm text-blue-800">{rec.monitoringPlan}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Feedback Component */}
      {assessment.recommendations.length > 0 && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold mb-4">Provider Decision</h3>
          <p className="text-sm text-gray-600 mb-4">
            Please indicate which recommendation you are accepting, or decline all if none are appropriate.
          </p>
          <RecommendationFeedback
            assessmentId={assessment.id}
            mrn={assessment.mrn}
            providerId={assessment.providerId}
            assessmentStartedAt={assessment.assessmentStartedAt}
            assessedAt={assessment.assessedAt}
            currentBiologic={{
              name: assessment.currentBiologicName || assessment.patient?.currentBiologics[0]?.drugName,
              dose: assessment.currentBiologicDose || assessment.patient?.currentBiologics[0]?.dose,
              frequency: assessment.currentBiologicFrequency || assessment.patient?.currentBiologics[0]?.frequency,
            }}
            recommendations={assessment.recommendations.map(r => ({
              id: r.id,
              rank: r.rank,
              drugName: r.drugName,
              tier: r.tier,
            }))}
          />
        </div>
      )}

      {assessment.recommendations.length === 0 && (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-gray-600 mb-2">No Recommendations Available</h3>
          <p className="text-sm text-gray-500">
            Unable to generate recommendations based on current data.
          </p>
        </div>
      )}

      {/* Complete Formulary Reference - Password Protected */}
      <FormularyReference
        formularyDrugs={safeFormularyDrugs}
        diagnosis={assessment.diagnosis}
      />

      {/* Contraindicated Drugs Toggle */}
      <ContraindicatedDrugsToggle
        contraindicatedDrugs={contraindicatedFormularyDrugs}
        diagnosis={assessment.diagnosis}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
