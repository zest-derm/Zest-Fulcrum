import OpenAI from 'openai';
import { BIOLOGICS_DATA } from './biologics-data';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedMetadata {
  title: string;
  authors: string;
  journal: string;
  year: number;
  pmid: string | null;
  doi: string | null;
  studyType: string;
  citationType: string;
  sampleSize: number | null;
  population: string | null;
  drugName: string;
  indications: string[];
  referenceDrugName: string | null;
  keyFindings: string;
}

/**
 * Extract all citation metadata from PDF text using GPT-5.2
 */
export async function extractCitationMetadata(
  fullText: string
): Promise<ExtractedMetadata> {
  try {
    // Truncate text if too long
    const maxLength = 16000;
    const truncatedText = fullText.length > maxLength
      ? fullText.substring(0, maxLength) + '...[truncated]'
      : fullText;

    // Generate drug list with generic→brand mappings
    const drugList = BIOLOGICS_DATA.map(bio => bio.brand).join(', ');
    const genericMappings = BIOLOGICS_DATA
      .map(bio => `${bio.generic}→${bio.brand}`)
      .join(', ');

    const prompt = `You are a clinical research specialist. Extract all relevant metadata from this research paper.

Paper text:
${truncatedText}

Extract the following information and return as JSON:

1. title - Full paper title
2. authors - All authors in format "LastName F, LastName F, et al."
3. journal - Journal name
4. year - Publication year (number)
5. pmid - PubMed ID if mentioned (or null)
6. doi - DOI if mentioned (or null)
7. studyType - One of: RCT, SYSTEMATIC_REVIEW, META_ANALYSIS, OBSERVATIONAL, CASE_SERIES, REGISTRY
8. citationType - One of: EFFICACY, SAFETY, BIOSIMILAR_EQUIVALENCE, HEAD_TO_HEAD, LONG_TERM_OUTCOMES, PHARMACOKINETICS, REAL_WORLD_EVIDENCE
9. sampleSize - Number of participants (or null)
10. population - Study population description (e.g., "Moderate-to-severe plaque psoriasis")
11. drugName - Primary drug being studied. MUST use exact brand name from this list: ${drugList}. Common generic→brand mappings: ${genericMappings}. For head-to-head trials, use the drug that showed superior efficacy or the newer/focus drug (not the comparator).
12. indications - Array of relevant conditions from: PSORIASIS, PSORIATIC_ARTHRITIS, ATOPIC_DERMATITIS, HIDRADENITIS_SUPPURATIVA, CROHNS_DISEASE, ULCERATIVE_COLITIS, RHEUMATOID_ARTHRITIS, ANKYLOSING_SPONDYLITIS, OTHER
13. referenceDrugName - For head-to-head or biosimilar studies, the comparison drug brand name (use same list as drugName). Otherwise null.
14. keyFindings - 3-5 sentence summary of key clinical findings

Return ONLY valid JSON in this exact format:
{
  "title": "string",
  "authors": "string",
  "journal": "string",
  "year": number,
  "pmid": "string or null",
  "doi": "string or null",
  "studyType": "string",
  "citationType": "string",
  "sampleSize": number or null,
  "population": "string or null",
  "drugName": "string",
  "indications": ["string"],
  "referenceDrugName": "string or null",
  "keyFindings": "string"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'You are a clinical research metadata extraction specialist. Extract structured metadata from medical literature and return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from GPT');
    }

    const metadata = JSON.parse(content);

    // Validate and clean up the data
    return {
      title: metadata.title || 'Unknown Title',
      authors: metadata.authors || 'Unknown Authors',
      journal: metadata.journal || 'Unknown Journal',
      year: metadata.year || new Date().getFullYear(),
      pmid: metadata.pmid || null,
      doi: metadata.doi || null,
      studyType: metadata.studyType || 'RCT',
      citationType: metadata.citationType || 'EFFICACY',
      sampleSize: metadata.sampleSize || null,
      population: metadata.population || null,
      drugName: metadata.drugName || 'Unknown',
      indications: Array.isArray(metadata.indications) ? metadata.indications : [],
      referenceDrugName: metadata.referenceDrugName || null,
      keyFindings: metadata.keyFindings || 'Key findings not extracted',
    };
  } catch (error: any) {
    console.error('Error extracting citation metadata:', error);
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}
