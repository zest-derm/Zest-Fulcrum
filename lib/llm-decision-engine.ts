import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';
import { normalizeToGeneric } from './drug-normalizer';
import {
  Patient,
  CurrentBiologic,
  PharmacyClaim,
  FormularyDrug,
  InsurancePlan,
  Contraindication,
  RecommendationType,
  DiagnosisType,
} from '@prisma/client';

// Lazy initialization to avoid build-time errors
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

export interface AssessmentInput {
  patientId?: string | null;
  planId: string;  // Required for PHI-free assessments
  medicationType?: string;  // 'biologic' or 'topical' - filters recommendations
  currentBiologic?: {
    drugName: string;
    dose: string;
    frequency: string;
  } | null;
  diagnosis: DiagnosisType;
  hasPsoriaticArthritis: boolean;
  contraindications?: string[];
  failedTherapies?: string[];
  isStable?: boolean;
  dlqiScore: number;
  bmi?: string | null;  // '<25', '25-30', '>30' - for BMI consideration
}

interface LLMRecommendation {
  type: RecommendationType;
  drugName?: string;
  newDose?: string;
  newFrequency?: string;
  rationale: string;
  monitoringPlan?: string;
  rank: number;
}

/**
 * Convert string requiresPA value to boolean
 * FormularyDrug stores as String ("Yes", "No", "N/A", "Unknown")
 * Recommendation stores as Boolean
 */
function convertRequiresPAToBoolean(requiresPA: string | null | undefined): boolean {
  return requiresPA === 'Yes';
}

/**
 * Strip markdown code blocks from LLM response
 * Handles responses like ```json\n{...}\n```
 */
function stripMarkdownCodeBlock(text: string): string {
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  const codeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = text.trim().match(codeBlockRegex);
  return match ? match[1].trim() : text.trim();
}

/**
 * Retrieve structured clinical findings from database
 *
 * Queries the ClinicalFinding table for human-reviewed findings
 * relevant to the patient's drug and diagnosis
 */
async function retrieveStructuredFindings(
  drugName: string | null,
  diagnosis: DiagnosisType
): Promise<string[]> {
  // Retrieve structured findings for relevant drugs
  if (drugName) {
    try {
      const findings = await prisma.clinicalFinding.findMany({
        where: {
          AND: [
            {
              OR: [
                { drug: { contains: drugName, mode: 'insensitive' } },
                { finding: { contains: drugName, mode: 'insensitive' } },
              ],
            },
            {
              OR: [
                { indication: { contains: diagnosis, mode: 'insensitive' } },
                { finding: { contains: diagnosis, mode: 'insensitive' } },
              ],
            },
            {
              findingType: {
                in: ['SAFETY', 'EFFICACY']
              },
            },
            // CRITICAL: Only use human-reviewed findings in decision engine
            // Unreviewed findings may contain errors or irrelevant information
            { reviewed: true },
          ],
        },
        orderBy: [
          { createdAt: 'desc' },  // Most recent first
        ],
        take: 15,  // More findings for comprehensive evidence
      });

      if (findings.length > 0) {
        // Format findings as clean, physician-ready text
        return findings.map(f =>
          `📄 ${f.paperTitle}\nCitation: ${f.citation}\nFinding: ${f.finding}`
        );
      }
    } catch (error) {
      console.error('Error retrieving structured findings:', error);
    }
  }

  // No findings found - return empty array (LLM will work without evidence context)
  return [];
}

/**
 * Filter drugs by FDA approved indications for the patient's diagnosis
 */
function filterByDiagnosis(
  drugs: FormularyDrug[],
  diagnosis: DiagnosisType
): FormularyDrug[] {
  return drugs.filter(drug => {
    // If no indications specified, include it (for backward compatibility)
    if (!drug.fdaIndications || drug.fdaIndications.length === 0) {
      return true;
    }
    // Check if the diagnosis matches any FDA indication (case-insensitive, partial match)
    // Handle both "PSORIASIS" (enum) and "Psoriasis" (data) formats
    // Also handle abbreviations like "PsA" for Psoriatic Arthritis
    const diagnosisLower = diagnosis.toLowerCase().replace(/_/g, ' ');

    return drug.fdaIndications.some(indication => {
      const indicationLower = indication.toLowerCase().replace(/_/g, ' ');
      // Exact match OR partial match (e.g., "psoriasis" matches "psoriatic arthritis")
      return indicationLower.includes(diagnosisLower) || diagnosisLower.includes(indicationLower);
    });
  });
}

/**
 * Filter out failed therapies and their biosimilars
 * If a drug or its biosimilars are in the failed therapies list, exclude it
 */
function filterFailedTherapies(
  drugs: FormularyDrug[],
  failedTherapies: string[]
): FormularyDrug[] {
  if (!failedTherapies || failedTherapies.length === 0) {
    return drugs;
  }

  return drugs.filter(drug => {
    const drugNameLower = drug.drugName.toLowerCase();
    const genericNameLower = drug.genericName.toLowerCase();

    // Check if this drug or its generic matches any failed therapy
    for (const failed of failedTherapies) {
      const failedLower = failed.toLowerCase();

      // Match by brand name
      if (drugNameLower === failedLower) {
        console.log(`  ⚠️  Excluding ${drug.drugName} - matches failed therapy ${failed}`);
        return false;
      }

      // Match by generic name (includes biosimilars)
      // e.g., if "Humira" failed, exclude all adalimumab drugs
      if (genericNameLower === failedLower || genericNameLower.startsWith(failedLower + '-')) {
        console.log(`  ⚠️  Excluding ${drug.drugName} (${drug.genericName}) - biosimilar of failed therapy ${failed}`);
        return false;
      }
    }

    return true;
  });
}

interface ContraindicatedDrug {
  drug: FormularyDrug;
  reasons: Array<{
    type: string;
    severity: 'ABSOLUTE' | 'RELATIVE';
    reason: string;
    details?: string;
  }>;
}

/**
 * Comprehensive contraindication checking
 * Returns both safe and contraindicated drugs with reasons and severity
 */
function checkDrugContraindications(
  drugs: FormularyDrug[],
  contraindications: Contraindication[]
): { safe: FormularyDrug[]; contraindicated: ContraindicatedDrug[] } {
  if (contraindications.length === 0) {
    return { safe: drugs, contraindicated: [] };
  }

  const safe: FormularyDrug[] = [];
  const contraindicated: ContraindicatedDrug[] = [];

  for (const drug of drugs) {
    const normalizedDrugClass = drug.drugClass?.toUpperCase().replace(/\s+/g, '_') || '';
    const reasons: ContraindicatedDrug['reasons'] = [];

    // Check each contraindication against drug class
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
        if (ciType === 'CYTOPENIAS') {
          reasons.push({
            type: ciType,
            severity: 'RELATIVE',
            reason: 'JAK inhibitors can worsen cytopenias. Requires baseline labs and monitoring.',
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
        if (ciType === 'DIVERTICULITIS') {
          reasons.push({
            type: ciType,
            severity: 'RELATIVE',
            reason: 'IL-17 inhibitors may increase intestinal perforation risk. Monitor for GI symptoms.',
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
      if (ciType === 'OPPORTUNISTIC_INFECTION') {
        reasons.push({
          type: ciType,
          severity: 'ABSOLUTE',
          reason: 'History of opportunistic infection requires ID consultation before biologics.',
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

      // GENERAL MALIGNANCY (if not already handled by specific drug class)
      if ((ciType === 'MALIGNANCY_LYMPHOMA' || ciType === 'MALIGNANCY') && !reasons.some(r => r.type === ciType)) {
        reasons.push({
          type: ciType,
          severity: 'RELATIVE',
          reason: 'Active or recent malignancy - biologics may affect tumor surveillance. Requires oncology clearance.',
          details: ci.details
        });
      }

      // OTHER RELATIVE CONTRAINDICATIONS
      if (ciType === 'IMMUNOCOMPROMISED' && !reasons.some(r => r.type === 'IMMUNOCOMPROMISED')) {
        reasons.push({
          type: ciType,
          severity: 'RELATIVE',
          reason: 'Immunocompromised state increases infection risk with biologics. Monitor closely.',
          details: ci.details
        });
      }
      if (ciType === 'LIVE_VACCINE_RECENT') {
        reasons.push({
          type: ciType,
          severity: 'RELATIVE',
          reason: 'Wait 4+ weeks after live vaccine before starting biologics. No live vaccines while on therapy.',
          details: ci.details
        });
      }
      if (ciType === 'SURGERY_PLANNED') {
        reasons.push({
          type: ciType,
          severity: 'RELATIVE',
          reason: 'Hold biologics peri-operatively to reduce infection risk. Timing depends on drug half-life.',
          details: ci.details
        });
      }
    }

    // Categorize drug as safe or contraindicated
    // Exclude if ANY absolute contraindication, or if ONLY showing safe drugs
    const hasAbsoluteContraindication = reasons.some(r => r.severity === 'ABSOLUTE');

    if (reasons.length === 0) {
      safe.push(drug);
    } else if (hasAbsoluteContraindication) {
      // Absolute contraindications - exclude from main recommendations
      contraindicated.push({ drug, reasons });
      console.log(`  ⚠️  ABSOLUTE contraindication: ${drug.drugName} - ${reasons.filter(r => r.severity === 'ABSOLUTE').map(r => r.type).join(', ')}`);
    } else {
      // Only relative contraindications - still flag but could be considered with caution
      contraindicated.push({ drug, reasons });
      console.log(`  ⚠️  RELATIVE contraindication: ${drug.drugName} - ${reasons.map(r => r.type).join(', ')}`);
    }
  }

  console.log(`Contraindication filtering: ${drugs.length} total → ${safe.length} safe, ${contraindicated.length} contraindicated (${contraindicated.filter(c => c.reasons.some(r => r.severity === 'ABSOLUTE')).length} absolute, ${contraindicated.filter(c => c.reasons.every(r => r.severity === 'RELATIVE')).length} relative)`);

  return { safe, contraindicated };
}

/**
 * Legacy function for backward compatibility - filters out all contraindicated drugs
 * Use checkDrugContraindications() for full tracking
 */
function filterContraindicated(
  drugs: FormularyDrug[],
  contraindications: Contraindication[]
): FormularyDrug[] {
  return checkDrugContraindications(drugs, contraindications).safe;
}

/**
 * LLM Ranking: Select next best biologic from formulary
 * Prioritizes lowest tier, then matches comorbidities, then ranks by efficacy
 */
async function getLLMRecommendationSuggestions(
  assessment: AssessmentInput,
  currentDrug: string | null,
  currentBiologic: any | null,
  evidence: string[],
  formularyOptions: FormularyDrug[],
  currentFormularyDrug: FormularyDrug | null,
  contraindications: Contraindication[],
  lowestTierInFormulary: number,
  currentTier: number,
  availableTiers: number[]
): Promise<LLMRecommendation[]> {
  const contraindicationText = contraindications.length > 0
    ? contraindications.map(c => c.type).join(', ')
    : 'None';

  // Get current brand name (not generic) to properly exclude from switch options
  const currentBrandName = currentFormularyDrug?.drugName || currentDrug;

  // Build BMI context if provided
  const bmiContext = assessment.bmi
    ? `BMI: ${assessment.bmi} ${assessment.bmi === '>30' ? '- Consider that weight-based biologics may require higher doses or more frequent administration in patients with higher BMI' : ''}`
    : '';

  // Filter and deduplicate formulary options
  // CRITICAL: Exclude the current brand drug AND deduplicate by generic name
  // to avoid showing multiple formulations of the same drug to the LLM
  const uniqueFormularyDrugs = new Map<string, FormularyDrug>();

  formularyOptions.forEach(drug => {
    // Exclude current brand drug
    if (currentBrandName && drug.drugName.toLowerCase() === currentBrandName.toLowerCase()) {
      return;
    }
    // Exclude by generic name match too (belt and suspenders)
    if (currentDrug && drug.drugName.toLowerCase() === currentDrug.toLowerCase()) {
      return;
    }

    // Deduplicate by generic name - keep first occurrence (usually most common formulation)
    const genericKey = drug.genericName.toLowerCase();
    if (!uniqueFormularyDrugs.has(genericKey)) {
      uniqueFormularyDrugs.set(genericKey, drug);
    }
  });

  // Show top 10 unique drugs, prioritizing lower tiers
  const formularyText = Array.from(uniqueFormularyDrugs.values())
    .slice(0, 10)
    .map(d => `${d.drugName} (${d.drugClass}, Tier ${d.tier}, PA: ${d.requiresPA ? 'Yes' : 'No'}, Annual Cost: $${d.annualCostWAC})`)
    .join('\n');

  const evidenceText = evidence.length > 0
    ? evidence.join('\n\n')
    : 'No specific evidence retrieved from knowledge base.';

  const prompt = `You are a clinical decision support AI for biologic selection. Your task is to recommend the next best biologic from the formulary for this patient.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PATIENT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Current medication: ${currentBrandName || 'None (initiating first biologic)'}
- Diagnosis: ${assessment.diagnosis}
- Psoriatic arthritis: ${assessment.hasPsoriaticArthritis ? 'YES - prefer IL-17, IL-23, or TNF inhibitors' : 'NO'}
${bmiContext}
- Contraindications: ${contraindicationText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMULARY OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Available tiers: [${availableTiers.join(', ')}]
Lowest tier (best for cost savings): Tier ${lowestTierInFormulary}
${currentBrandName ? `Current drug tier: Tier ${currentTier}` : ''}

Available Formulary Options (current drug excluded, deduplicated by generic):
${formularyText}

⚠️ CRITICAL PRIORITY: Cost savings is THE goal. ALWAYS prioritize Tier ${lowestTierInFormulary} (lowest tier) first.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLINICAL EVIDENCE (for reference only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${evidenceText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECTION ALGORITHM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Step 1: Filter by Tier**
- Prioritize Tier ${lowestTierInFormulary} drugs first
- Then Tier ${availableTiers[1] || 'N/A'}
- Then higher tiers if needed

**Step 2: Match Comorbidities (within tier)**
- Psoriatic Arthritis → IL-17 inhibitors (Cosentyx, Taltz, Siliq) or IL-23 inhibitors (Tremfya, Skyrizi, Ilumya) or TNF inhibitors (Humira, Enbrel, Cimzia)
- Asthma + Atopic Dermatitis → Dupixent strongly preferred (multi-indication benefit)
- Inflammatory Bowel Disease → AVOID IL-17 inhibitors

**Step 3: Rank by Efficacy (within tier, after comorbidity match)**
Psoriasis efficacy hierarchy:
1. IL-23 inhibitors (Risankizumab/Skyrizi, Guselkumab/Tremfya, Tildrakizumab/Ilumya) - highest efficacy
2. IL-17 inhibitors (Secukinumab/Cosentyx, Ixekizumab/Taltz, Brodalumab/Siliq) - excellent efficacy
3. TNF inhibitors (Adalimumab/Humira, Etanercept/Enbrel, Certolizumab/Cimzia) - good efficacy
4. IL-4/13 inhibitors (Dupilumab/Dupixent) - moderate psoriasis efficacy, excellent for AD
5. Oral agents (Apremilast/Otezla, Deucravacitinib/Sotyktu) - moderate efficacy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate EXACTLY 3 recommendations ranked by:
1. LOWEST tier first (Tier ${lowestTierInFormulary} priority)
2. Comorbidity match (if PsA present)
3. Efficacy (IL-23 > IL-17 > TNF for psoriasis)

For EACH recommendation provide:
1. **Type**: Use "INITIATE_BIOLOGIC" for all recommendations
2. **Drug name**: From formulary options above (NEVER recommend current drug)
3. **New dose**: FDA-approved specific dose (e.g., "300 mg", "80 mg initial then 40 mg") - NEVER use "Per label"
4. **New frequency**: FDA-approved specific frequency (e.g., "every 4 weeks after loading") - NEVER use "Per label"
5. **Rationale**: Explain why this drug is recommended:
   - Mention tier and cost savings if applicable
   - Mention comorbidity match if applicable (e.g., "IL-17 inhibitor appropriate for psoriatic arthritis")
   - Mention efficacy profile
   - Keep concise (2-3 sentences)
6. **Monitoring plan**: Standard follow-up (e.g., "Assess efficacy at 12-16 weeks")
7. **Rank**: 1, 2, or 3

⚠️ NEVER output placeholder text like "No options available"
⚠️ NEVER recommend the current drug
⚠️ NEVER recommend same drug twice
⚠️ All recommendations must be type "INITIATE_BIOLOGIC"

Return ONLY valid JSON with this exact structure:
{
  "recommendations": [
    {
      "type": "INITIATE_BIOLOGIC",
      "drugName": "string",
      "newDose": "string",
      "newFrequency": "string",
      "rationale": "string",
      "monitoringPlan": "string",
      "rank": number
    }
  ]
}`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.4,
      system: 'You are a clinical decision support AI for biologic selection. Recommend the next best biologic from the formulary, prioritizing lowest tier and matching comorbidities. Always respond with valid JSON only, no other text.',
      messages: [{ role: 'user', content: prompt }],
    });

    const responseContent = response.content[0];
    const rawContent = responseContent.type === 'text' ? responseContent.text : '{}';
    console.log('LLM Response:', rawContent); // Debug logging
    const cleanJson = stripMarkdownCodeBlock(rawContent);
    const parsed = JSON.parse(cleanJson);

    // Handle both array and object responses
    const recommendations = Array.isArray(parsed) ? parsed : (parsed.recommendations || []);

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.error('LLM returned no recommendations, response was:', content);
      throw new Error('LLM returned no recommendations');
    }

    return recommendations as LLMRecommendation[];
  } catch (error) {
    console.error('Error getting LLM recommendations:', error);
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Calculate cost savings for switching biologics
 */
function calculateCostSavings(
  recommendation: LLMRecommendation,
  currentDrug: FormularyDrug | null,
  targetDrug: FormularyDrug | null
) {
  let currentAnnualCost = currentDrug?.annualCostWAC?.toNumber();
  let recommendedAnnualCost: number | undefined;
  let annualSavings: number | undefined;
  let savingsPercent: number | undefined;

  if (targetDrug && currentAnnualCost) {
    recommendedAnnualCost = targetDrug.annualCostWAC?.toNumber();
    if (recommendedAnnualCost) {
      annualSavings = currentAnnualCost - recommendedAnnualCost;
      savingsPercent = (annualSavings / currentAnnualCost) * 100;
    }
  }

  return {
    currentAnnualCost,
    recommendedAnnualCost,
    annualSavings,
    savingsPercent,
    currentMonthlyOOP: currentDrug?.memberCopayT1?.div(12).toNumber(),
    recommendedMonthlyOOP: targetDrug?.memberCopayT1?.div(12).toNumber(),
  };
}

/**
 * Main function: Generate biologic recommendations using LLM ranking
 * Simplified architecture: Only recommends next best biologic (switching or initiation)
 */
export async function generateLLMRecommendations(
  assessment: AssessmentInput
): Promise<{
  recommendations: any[];
  formularyReference?: any[];
  contraindicatedDrugs?: Array<{
    drugName: string;
    drugClass: string;
    tier: number;
    requiresPA: string | null;
    annualCost: number | null;
    reasons: Array<{
      type: string;
      severity: 'ABSOLUTE' | 'RELATIVE';
      reason: string;
      details?: string;
    }>;
  }>;
}> {
  // Fetch patient data if patientId is provided
  const patient = assessment.patientId
    ? await prisma.patient.findUnique({
        where: { id: assessment.patientId },
        include: {
          currentBiologics: true,
          claims: {
            orderBy: { fillDate: 'desc' },
            take: 12,
          },
          contraindications: true,
          plan: true,
        },
      })
    : null;

  // Determine the effective plan ID
  // Priority: assessment.planId > patient.planId > resolved from formularyPlanName
  let effectivePlanId = assessment.planId || patient?.planId;

  if (!effectivePlanId && patient?.formularyPlanName) {
    // If no planId but has formularyPlanName, try to find the plan by name
    const planByName = await prisma.insurancePlan.findFirst({
      where: { planName: patient.formularyPlanName },
    });
    if (planByName) {
      effectivePlanId = planByName.id;
      console.log(`  ℹ️ Resolved formularyPlanName "${patient.formularyPlanName}" to planId: ${effectivePlanId}`);
    } else {
      console.warn(`  ⚠️ Patient has formularyPlanName "${patient.formularyPlanName}" but no matching InsurancePlan found`);
    }
  }

  if (!effectivePlanId) {
    throw new Error('Plan ID is required for generating recommendations');
  }

  // Fetch the plan details
  const plan = await prisma.insurancePlan.findUnique({
    where: { id: effectivePlanId },
  });

  if (!plan) {
    throw new Error(`Insurance plan not found: ${effectivePlanId}`);
  }

  // Get the most recent formulary upload for this plan
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

  // Fetch formulary drugs from the most recent upload only
  const formularyDrugs = mostRecentUpload && effectivePlanId
    ? await prisma.formularyDrug.findMany({
        where: {
          planId: effectivePlanId,
          uploadLogId: mostRecentUpload.id,
        },
      })
    : [];

  // Get current biologic from patient data OR assessment input
  const currentBiologic = patient?.currentBiologics?.[0] || (assessment.currentBiologic
    ? {
        drugName: assessment.currentBiologic.drugName,
        dose: assessment.currentBiologic.dose,
        frequency: assessment.currentBiologic.frequency,
        route: 'Subcutaneous', // Default for biologics
        startDate: new Date(),
        lastFillDate: null,
      }
    : null);

  const hasCurrentBiologic = !!currentBiologic;

  // Build patientWithFormulary object (for PHI-free, use assessment data)
  const patientWithFormulary = patient
    ? {
        ...patient,
        plan: {
          ...plan,
          formularyDrugs,
        },
      }
    : {
        id: assessment.patientId || 'phi-free',
        planId: effectivePlanId,
        plan: {
          ...plan,
          formularyDrugs,
        },
        currentBiologics: currentBiologic ? [currentBiologic] : [],
        claims: [],
        contraindications: (assessment.contraindications || []).map(c => ({
          type: c as any,
          severity: 'RELATIVE' as const,
        })),
      };

  console.log(`\n━━━ FORMULARY MATCHING DEBUG ━━━`);
  console.log(`Total formulary drugs available: ${patientWithFormulary.plan.formularyDrugs.length}`);
  console.log(`Formulary drugs:`, patientWithFormulary.plan.formularyDrugs.map(d => `${d.drugName} (generic: ${d.genericName}, tier: ${d.tier})`));

  // Normalize drug name to generic (or null if not on biologic)
  const genericDrugName = currentBiologic
    ? await normalizeToGeneric(currentBiologic.drugName)
    : null;

  console.log(`\nLooking for current biologic: "${currentBiologic?.drugName}"`);
  console.log(`Normalized to generic: "${genericDrugName}"`);

  // Find current drug in formulary (BRAND NAME FIRST, then generic fallback)
  // CRITICAL: Must prioritize exact brand match to avoid Humira matching to Amjevita
  const currentFormularyDrug = currentBiologic
    ? (() => {
        // Step 1: Try exact brand name match first
        const brandMatch = patientWithFormulary.plan.formularyDrugs.find(drug =>
          drug.drugName.toLowerCase() === currentBiologic.drugName.toLowerCase()
        );

        if (brandMatch) {
          console.log(`  ✓ Found EXACT brand match: ${brandMatch.drugName}`);
          return brandMatch;
        }

        // Step 2: Fall back to generic name match (for biosimilars)
        if (genericDrugName) {
          const genericMatch = patientWithFormulary.plan.formularyDrugs.find(drug =>
            drug.genericName.toLowerCase() === genericDrugName.toLowerCase() ||
            drug.genericName.toLowerCase().startsWith(genericDrugName.toLowerCase() + '-')
          );

          if (genericMatch) {
            console.log(`  ✓ Found generic match: ${genericMatch.drugName} (generic: ${genericMatch.genericName})`);
            return genericMatch;
          }
        }

        console.log(`  ✗ No match found for ${currentBiologic.drugName}`);
        return null;
      })()
    : null;

  console.log(`Found current drug in formulary:`, currentFormularyDrug ? `YES - ${currentFormularyDrug.drugName} Tier ${currentFormularyDrug.tier}` : 'NO');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Find lowest tier available in formulary (relative tier detection)
  const indicatedDrugs = formularyDrugs.filter(drug =>
    filterByDiagnosis([drug], assessment.diagnosis).length > 0
  );
  const availableTiers = [...new Set(indicatedDrugs.map(d => d.tier))].sort((a, b) => a - b);
  const lowestTierInFormulary = availableTiers[0] || 999;
  const currentTier = currentFormularyDrug?.tier || 999;
  console.log(`Formulary tier structure: Available tiers = [${availableTiers.join(', ')}], Lowest = ${lowestTierInFormulary}, Current = ${currentTier}`);

  // Retrieve structured clinical findings from database
  // Uses human-reviewed findings from ClinicalFinding table
  const evidence = await retrieveStructuredFindings(genericDrugName, assessment.diagnosis);
  console.log(`Retrieved ${evidence.length} structured clinical findings for LLM context`);

  // Step 4: Filter drugs by diagnosis, then by contraindications, then by failed therapies
  const diagnosisAppropriateDrugs = filterByDiagnosis(patientWithFormulary.plan.formularyDrugs, assessment.diagnosis);
  const { safe: safeFormularyDrugs, contraindicated: contraindicatedDrugs } = checkDrugContraindications(
    diagnosisAppropriateDrugs,
    patientWithFormulary.contraindications
  );
  const availableFormularyDrugs = filterFailedTherapies(safeFormularyDrugs, assessment.failedTherapies || []);
  console.log(`Filtered formulary: ${patientWithFormulary.plan.formularyDrugs.length} total → ${diagnosisAppropriateDrugs.length} for ${assessment.diagnosis} → ${safeFormularyDrugs.length} safe, ${contraindicatedDrugs.length} contraindicated → ${availableFormularyDrugs.length} after excluding failed therapies`);

  // Sort available formulary drugs (after excluding failed therapies) to prioritize lower tiers
  const sortedFormularyDrugs = [...availableFormularyDrugs].sort((a, b) => {
    // Sort by tier first (lower is better)
    if (a.tier !== b.tier) return a.tier - b.tier;
    // Then by PA requirement (no PA is better)
    if (a.requiresPA !== b.requiresPA) return a.requiresPA ? 1 : -1;
    // Then by cost (lower is better)
    const costA = a.annualCostWAC?.toNumber() || 0;
    const costB = b.annualCostWAC?.toNumber() || 0;
    return costA - costB;
  });

  // LLM Recommendations: Rank next best biologics from formulary
  const rawLlmRecs = await getLLMRecommendationSuggestions(
    assessment,
    genericDrugName,
    currentBiologic,
    evidence,
    sortedFormularyDrugs,
    currentFormularyDrug || null,
    patientWithFormulary.contraindications,
    lowestTierInFormulary,
    currentTier,
    availableTiers
  );

  // Deduplicate and validate recommendations
  // Filter out: duplicates, invalid drug names
  const seenDrugs = new Set<string>();
  const llmRecs = rawLlmRecs.filter(rec => {
    // Filter out placeholder/invalid drug names
    const invalidDrugNames = ['no tier 1', 'no tier 2', 'no tier', 'not available', 'none available'];
    if (rec.drugName && invalidDrugNames.some(invalid => rec.drugName!.toLowerCase().includes(invalid))) {
      console.log(`  ⚠️  Removing invalid placeholder recommendation: ${rec.drugName}`);
      return false;
    }

    // Check for duplicates
    const drugKey = rec.drugName?.toLowerCase();
    if (!drugKey || seenDrugs.has(drugKey)) {
      console.log(`  ℹ️  Removing duplicate recommendation for: ${rec.drugName}`);
      return false;
    }
    seenDrugs.add(drugKey);
    return true;
  });

  console.log(`LLM generated ${rawLlmRecs.length} recommendations, kept ${llmRecs.length} after validation`);

  // Step 5: Add cost calculations and attach structured evidence
  // Evidence comes from ClinicalFinding database table (human-reviewed findings)
  const recommendations = await Promise.all(llmRecs.map(async rec => {
    const targetDrug = rec.drugName
      ? patientWithFormulary.plan.formularyDrugs.find(d => d.drugName.toLowerCase() === rec.drugName?.toLowerCase()) ?? null
      : null;

    const costData = calculateCostSavings(rec, currentFormularyDrug, targetDrug);

    // All recommendations are for target drugs (initiations/switches)
    const displayDrugName = rec.drugName || genericDrugName;

    // Get FDA-approved dosing if LLM didn't provide specific dosing or used "Per label"
    let finalDose = rec.newDose || '';
    let finalFrequency = rec.newFrequency || '';

    // If LLM returned generic "Per label" or empty, use our reference
    const needsDosingReference = !finalDose || !finalFrequency ||
                                  finalDose.toLowerCase().includes('per label') ||
                                  finalFrequency.toLowerCase().includes('per label');

    if (needsDosingReference && displayDrugName) {
      // Use FDA-approved dosing reference
      const standardDosing = getSpecificDrugDosing(displayDrugName);
      finalDose = standardDosing.dose;
      finalFrequency = standardDosing.frequency;
    }

    return {
      rank: rec.rank,
      type: rec.type,
      drugName: displayDrugName,
      newDose: finalDose,
      newFrequency: finalFrequency,
      ...costData,
      rationale: rec.rationale,
      evidenceSources: evidence, // Use structured clinical findings from database
      monitoringPlan: rec.monitoringPlan,
      // All recommendations are initiations, use target drug's tier
      tier: targetDrug?.tier || currentFormularyDrug?.tier,
      // Convert string requiresPA to boolean (FormularyDrug uses String, Recommendation uses Boolean)
      requiresPA: convertRequiresPAToBoolean(targetDrug?.requiresPA || currentFormularyDrug?.requiresPA),
      contraindicated: false, // LLM should handle contraindications in rationale
      contraindicationReason: undefined,
    };
  }));

  // Create complete formulary reference (all safe drugs sorted by tier)
  const formularyReference = sortedFormularyDrugs.map(drug => ({
    drugName: drug.drugName,
    genericName: drug.genericName || drug.drugName,
    drugClass: drug.drugClass,
    tier: drug.tier,
    requiresPA: drug.requiresPA,
    standardDosing: getDrugStandardDosing(drug.drugClass),
    annualCost: drug.annualCostWAC?.toNumber(),
  }));

  // Format contraindicated drugs for UI
  const contraindicatedDrugsFormatted = contraindicatedDrugs.map(ci => ({
    drugName: ci.drug.drugName,
    drugClass: ci.drug.drugClass,
    tier: ci.drug.tier,
    requiresPA: ci.drug.requiresPA,
    annualCost: ci.drug.annualCostWAC?.toNumber() || null,
    reasons: ci.reasons,
  }));

  return {
    recommendations: recommendations.slice(0, 3),
    formularyReference,
    contraindicatedDrugs: contraindicatedDrugsFormatted,
  };
}

/**
 * Helper: Get standard FDA-approved dosing for specific biologics
 */
function getSpecificDrugDosing(drugName: string): { dose: string; frequency: string } {
  const normalizedName = drugName.toLowerCase();

  // TNF Inhibitors (Adalimumab biosimilars and originator)
  if (normalizedName.includes('humira') || normalizedName.includes('adalimumab') ||
      normalizedName.includes('amjevita') || normalizedName.includes('hyrimoz') ||
      normalizedName.includes('cyltezo') || normalizedName.includes('hadlima') ||
      normalizedName.includes('abrilada') || normalizedName.includes('yusimry')) {
    return {
      dose: '80 mg initial dose, then 40 mg',
      frequency: 'every 2 weeks starting 1 week after initial dose'
    };
  }

  if (normalizedName.includes('enbrel') || normalizedName.includes('etanercept')) {
    return {
      dose: '50 mg',
      frequency: 'twice weekly for 3 months, then once weekly (or 50 mg twice weekly may continue)'
    };
  }

  if (normalizedName.includes('cimzia') || normalizedName.includes('certolizumab')) {
    return {
      dose: '400 mg (given as two 200 mg injections)',
      frequency: 'every 2 weeks, or 400 mg at weeks 0, 2, 4, then every 4 weeks'
    };
  }

  // IL-17 Inhibitors
  if (normalizedName.includes('cosentyx') || normalizedName.includes('secukinumab')) {
    return {
      dose: '300 mg',
      frequency: 'at weeks 0, 1, 2, 3, 4, then every 4 weeks'
    };
  }

  if (normalizedName.includes('taltz') || normalizedName.includes('ixekizumab')) {
    return {
      dose: '160 mg initial dose (two 80 mg injections), then 80 mg',
      frequency: 'every 2 weeks for weeks 2, 4, 6, 8, 10, 12, then every 4 weeks'
    };
  }

  if (normalizedName.includes('siliq') || normalizedName.includes('brodalumab')) {
    return {
      dose: '210 mg',
      frequency: 'at weeks 0, 1, 2, then every 2 weeks'
    };
  }

  // IL-23 Inhibitors
  if (normalizedName.includes('tremfya') || normalizedName.includes('guselkumab')) {
    return {
      dose: '100 mg',
      frequency: 'at weeks 0, 4, then every 8 weeks'
    };
  }

  if (normalizedName.includes('skyrizi') || normalizedName.includes('risankizumab')) {
    return {
      dose: '150 mg (two 75 mg injections)',
      frequency: 'at weeks 0, 4, then every 12 weeks'
    };
  }

  if (normalizedName.includes('ilumya') || normalizedName.includes('tildrakizumab')) {
    return {
      dose: '100 mg',
      frequency: 'at weeks 0, 4, then every 12 weeks'
    };
  }

  // IL-12/23 Inhibitor
  if (normalizedName.includes('stelara') || normalizedName.includes('ustekinumab')) {
    return {
      dose: '45 mg (for patients ≤100 kg) or 90 mg (for patients >100 kg)',
      frequency: 'at weeks 0, 4, then every 12 weeks'
    };
  }

  // IL-4/13 Inhibitor (Atopic Dermatitis)
  if (normalizedName.includes('dupixent') || normalizedName.includes('dupilumab')) {
    return {
      dose: '600 mg loading dose (two 300 mg injections), then 300 mg',
      frequency: 'every 2 weeks'
    };
  }

  // JAK Inhibitors
  if (normalizedName.includes('rinvoq') || normalizedName.includes('upadacitinib')) {
    return {
      dose: '15 mg orally once daily',
      frequency: 'daily (may increase to 30 mg for inadequate response)'
    };
  }

  if (normalizedName.includes('cibinqo') || normalizedName.includes('abrocitinib')) {
    return {
      dose: '100 mg orally once daily',
      frequency: 'daily (may adjust to 200 mg or 50 mg based on response)'
    };
  }

  if (normalizedName.includes('sotyktu') || normalizedName.includes('deucravacitinib')) {
    return {
      dose: '6 mg orally once daily',
      frequency: 'daily'
    };
  }

  // IL-13 Inhibitor
  if (normalizedName.includes('adbry') || normalizedName.includes('tralokinumab')) {
    return {
      dose: '600 mg loading dose (four 150 mg injections), then 300 mg',
      frequency: 'every 2 weeks (may extend to every 4 weeks after 16 weeks if clear/almost clear)'
    };
  }

  // Default fallback
  return {
    dose: 'Per FDA label',
    frequency: 'Per FDA label'
  };
}

/**
 * Helper: Get standard dosing for drug classes (deprecated, use getSpecificDrugDosing)
 */
function getDrugStandardDosing(drugClass: string): string {
  const dosingMap: Record<string, string> = {
    'TNF_INHIBITOR': 'Per label (varies by drug)',
    'IL17_INHIBITOR': 'Per label (varies by drug)',
    'IL23_INHIBITOR': 'Per label (varies by drug)',
    'IL12_23_INHIBITOR': 'Per label (varies by drug)',
    'JAK_INHIBITOR': 'Per label (varies by drug)',
    'OTHER': 'Per label',
  };
  return dosingMap[drugClass] || 'Per label';
}
