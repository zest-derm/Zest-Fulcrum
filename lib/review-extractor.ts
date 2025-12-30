import Anthropic from '@anthropic-ai/sdk';
import { BIOLOGICS_DATA } from './biologics-data';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Types for extraction results
export interface ReviewMetadata {
  title: string;
  authors: string;
  year: number;
  journal: string;
  totalStudies: number;
}

export interface StudyReference {
  id: string; // Unique identifier (FirstAuthor_Year)
  title: string;
  authors: string;
  journal: string;
  year: number;
  pmid?: string;
  doi?: string;
}

export interface DocumentStructure {
  totalPages: number;
  sectionMap: {
    [sectionName: string]: number[]; // Section name -> page numbers
  };
  tables: {
    pageNumber: number;
    caption: string;
    content?: string;
  }[];
  figures: {
    pageNumber: number;
    caption: string;
  }[];
  referenceSection: {
    startPage: number;
    endPage: number;
  };
}

export interface ExtractedStudyData {
  // Citation metadata
  title: string;
  authors: string;
  journal: string;
  year: number;
  pmid: string | null;
  doi: string | null;

  // Study characteristics
  studyType: string;
  citationType: string;
  sampleSize: number | null;
  population: string | null;

  // Drug and indication
  drugName: string[];
  indications: string[];
  referenceDrugName: string | null;

  // Extracted findings
  keyFindings: string;

  // Source tracking
  mentionedOnPages: number[];
  extractedFromSections: string[];
  extractionConfidence: 'high' | 'medium' | 'low';
  needsReview: boolean;
}

/**
 * Stage 1: Analyze full document structure
 * Sends entire 99-page PDF to Claude Opus once
 */
export async function analyzeReviewDocument(
  fullText: string
): Promise<{
  metadata: ReviewMetadata;
  references: StudyReference[];
  structure: DocumentStructure;
}> {
  try {
    const drugList = BIOLOGICS_DATA.map(bio => bio.brand).join(', ');

    const prompt = `You are analyzing a comprehensive clinical review (likely a Cochrane review or network meta-analysis).
This document contains many individual studies. Your task is to extract the document structure and all study references.

DOCUMENT TEXT:
${fullText}

Extract the following and return as JSON:

1. **metadata**: Review-level information
   - title: Full title of this review document
   - authors: Review authors (e.g., "Smith AB, Jones CD, et al.")
   - year: Publication year
   - journal: Journal name
   - totalStudies: Total number of individual studies mentioned in this review

2. **references**: Complete list of ALL individual studies cited in this review
   For each study, extract:
   - id: Unique identifier (FirstAuthorLastName_Year, e.g., "Blauvelt_2022")
   - title: Study title
   - authors: Study authors (format: "LastName F, LastName F, et al.")
   - journal: Journal name
   - year: Publication year (number)
   - pmid: PubMed ID if available (string or null)
   - doi: DOI if available (string or null)

3. **structure**: Document organization
   - totalPages: Total number of pages
   - sectionMap: Map of section names to page ranges (e.g., {"Results": [10, 11, 12, 13], "Discussion": [25, 26]})
   - tables: List of tables with page numbers and captions
   - figures: List of figures with page numbers and captions
   - referenceSection: Start and end page of bibliography

IMPORTANT:
- Extract ALL studies (there may be 100-250 studies)
- Use exact author names and years for creating unique IDs
- Be thorough - this is the master index for the entire extraction process

Return ONLY valid JSON in this format:
{
  "metadata": {
    "title": "string",
    "authors": "string",
    "year": number,
    "journal": "string",
    "totalStudies": number
  },
  "references": [
    {
      "id": "string",
      "title": "string",
      "authors": "string",
      "journal": "string",
      "year": number,
      "pmid": "string or null",
      "doi": "string or null"
    }
  ],
  "structure": {
    "totalPages": number,
    "sectionMap": {
      "section_name": [page_numbers]
    },
    "tables": [
      {
        "pageNumber": number,
        "caption": "string",
        "content": "string or null"
      }
    ],
    "figures": [
      {
        "pageNumber": number,
        "caption": "string"
      }
    ],
    "referenceSection": {
      "startPage": number,
      "endPage": number
    }
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 16000, // Large response needed for 250 studies
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    const result = JSON.parse(responseText);

    return {
      metadata: result.metadata,
      references: result.references,
      structure: result.structure,
    };
  } catch (error: any) {
    console.error('Error in analyzeReviewDocument:', error);
    throw new Error(`Failed to analyze review document: ${error.message}`);
  }
}

/**
 * Stage 2: Extract data for a single study
 * Uses focused context from relevant pages
 */
export async function extractStudyData(
  studyReference: StudyReference,
  relevantExcerpts: string[]
): Promise<ExtractedStudyData> {
  try {
    const drugList = BIOLOGICS_DATA.map(bio => bio.brand).join(', ');
    const genericMappings = BIOLOGICS_DATA
      .map(bio => `${bio.generic}→${bio.brand}`)
      .join(', ');

    // Combine all relevant excerpts
    const combinedContext = relevantExcerpts.join('\n\n---\n\n');

    const prompt = `You are extracting data for a specific study from a comprehensive review.

STUDY REFERENCE:
Title: ${studyReference.title}
Authors: ${studyReference.authors}
Year: ${studyReference.year}
PMID: ${studyReference.pmid || 'Not provided'}
DOI: ${studyReference.doi || 'Not provided'}

RELEVANT EXCERPTS FROM REVIEW (mentions of this study):
${combinedContext}

Extract the following information about THIS SPECIFIC STUDY and return as JSON:

1. **studyType**: One of: RCT, SYSTEMATIC_REVIEW, META_ANALYSIS, OBSERVATIONAL, CASE_SERIES, REGISTRY
2. **citationType**: One of: EFFICACY, SAFETY, BIOSIMILAR_EQUIVALENCE, HEAD_TO_HEAD, LONG_TERM_OUTCOMES, PHARMACOKINETICS, REAL_WORLD_EVIDENCE
3. **sampleSize**: Number of participants (number or null)
4. **population**: Study population description (e.g., "Moderate-to-severe plaque psoriasis")
5. **drugName**: ARRAY of drugs studied in THIS study. MUST use exact brand names from: ${drugList}. Generic→brand mappings: ${genericMappings}
6. **indications**: Array of conditions from: PSORIASIS, PSORIATIC_ARTHRITIS, ATOPIC_DERMATITIS, HIDRADENITIS_SUPPURATIVA, CROHNS_DISEASE, ULCERATIVE_COLITIS, RHEUMATOID_ARTHRITIS, ANKYLOSING_SPONDYLITIS, OTHER
7. **referenceDrugName**: For head-to-head or biosimilar studies, the comparison drug (string or null)
8. **keyFindings**: 3-5 sentence summary of key results for THIS study (efficacy rates, safety events, conclusions)
9. **extractionConfidence**: "high" (clear data), "medium" (some ambiguity), or "low" (limited info)
10. **needsReview**: true if data is unclear or contradictory, false otherwise

Return ONLY valid JSON in this format:
{
  "studyType": "string",
  "citationType": "string",
  "sampleSize": number or null,
  "population": "string or null",
  "drugName": ["string"],
  "indications": ["string"],
  "referenceDrugName": "string or null",
  "keyFindings": "string",
  "extractionConfidence": "high" | "medium" | "low",
  "needsReview": boolean
}`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    const extracted = JSON.parse(responseText);

    // Combine with reference metadata
    return {
      title: studyReference.title,
      authors: studyReference.authors,
      journal: studyReference.journal,
      year: studyReference.year,
      pmid: studyReference.pmid || null,
      doi: studyReference.doi || null,
      studyType: extracted.studyType,
      citationType: extracted.citationType,
      sampleSize: extracted.sampleSize,
      population: extracted.population,
      drugName: Array.isArray(extracted.drugName) ? extracted.drugName : [extracted.drugName],
      indications: Array.isArray(extracted.indications) ? extracted.indications : [],
      referenceDrugName: extracted.referenceDrugName,
      keyFindings: extracted.keyFindings,
      mentionedOnPages: [], // Will be populated by caller
      extractedFromSections: [], // Will be populated by caller
      extractionConfidence: extracted.extractionConfidence,
      needsReview: extracted.needsReview,
    };
  } catch (error: any) {
    console.error(`Error extracting study ${studyReference.id}:`, error);
    throw new Error(`Failed to extract study data: ${error.message}`);
  }
}

/**
 * Find all mentions of a specific study in the full text
 * Returns relevant excerpts for extraction
 */
export function findStudyMentions(
  fullText: string,
  studyReference: StudyReference
): { excerpts: string[]; pages: number[]; sections: string[] } {
  const firstAuthorLastName = studyReference.authors.split(',')[0].trim().split(' ')[0];
  const year = studyReference.year;

  // Search pattern: "FirstAuthor Year" or "FirstAuthor et al. Year"
  const searchPattern = new RegExp(
    `${firstAuthorLastName}[^.]*?\\b${year}\\b`,
    'gi'
  );

  const excerpts: string[] = [];
  const pages: number[] = [];
  const sections: string[] = [];

  // Split text into chunks (approximate pages)
  const lines = fullText.split('\n');
  const linesPerPage = 50; // Rough approximation

  for (let i = 0; i < lines.length; i += linesPerPage) {
    const pageNum = Math.floor(i / linesPerPage) + 1;
    const pageText = lines.slice(i, i + linesPerPage).join('\n');

    if (searchPattern.test(pageText)) {
      // Extract context around the mention (±5 lines)
      const startLine = Math.max(0, i - 5);
      const endLine = Math.min(lines.length, i + linesPerPage + 5);
      const excerpt = lines.slice(startLine, endLine).join('\n');

      excerpts.push(excerpt);
      pages.push(pageNum);

      // Try to identify section (look for headers)
      const sectionMatch = excerpt.match(/^(Results|Methods|Discussion|Background|Conclusions?|Table \d+|Figure \d+)/mi);
      if (sectionMatch) {
        sections.push(sectionMatch[1]);
      }
    }
  }

  return { excerpts, pages, sections };
}
