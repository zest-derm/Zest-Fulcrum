import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract key findings from a research paper's full text using LLM
 * @param fullText - The complete text of the research paper
 * @param drugName - The drug name for context
 * @param citationType - The type of citation (efficacy, safety, etc.)
 * @returns Extracted key findings as a concise summary
 */
export async function extractKeyFindings(
  fullText: string,
  drugName: string,
  citationType: string
): Promise<string> {
  try {
    // Truncate text if too long (GPT-4 context limit consideration)
    const maxLength = 12000; // Leave room for prompt and response
    const truncatedText = fullText.length > maxLength
      ? fullText.substring(0, maxLength) + '...[truncated]'
      : fullText;

    const prompt = `You are a clinical research specialist. Extract the key findings from this research paper about ${drugName}.

Focus on findings related to: ${citationType}

Paper text:
${truncatedText}

Please provide a concise summary (3-5 sentences) of the key clinical findings that would be most relevant for physician decision-making. Focus on:
- Primary efficacy/safety outcomes
- Statistically significant results
- Clinical relevance
- Comparative data if available

Format as clear, professional physician-ready sentences.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'You are a clinical research specialist who extracts key findings from medical literature for physician decision support.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const keyFindings = response.choices[0]?.message?.content || '';

    if (!keyFindings) {
      throw new Error('No key findings extracted from LLM response');
    }

    return keyFindings.trim();
  } catch (error: any) {
    console.error('Error extracting key findings with LLM:', error);
    throw new Error(`Failed to extract key findings: ${error.message}`);
  }
}

/**
 * Query citations and format them for inclusion in recommendation prompts
 * @param drugName - The drug name
 * @param indications - The relevant indications
 * @param citations - Array of citation objects
 * @returns Formatted citation text for LLM prompt
 */
export function formatCitationsForPrompt(
  drugName: string,
  indications: string[],
  citations: Array<{
    title: string;
    authors: string;
    journal: string;
    year: number;
    keyFindings: string;
    citationType: string;
    pmid: string | null;
    doi: string | null;
  }>
): string {
  if (citations.length === 0) {
    return 'No clinical literature citations available.';
  }

  const formattedCitations = citations.map((citation, index) => {
    const pmidLink = citation.pmid ? `PMID: ${citation.pmid}` : '';
    const doiLink = citation.doi ? `DOI: ${citation.doi}` : '';
    const links = [pmidLink, doiLink].filter(Boolean).join(', ');

    return `
Citation ${index + 1} (${citation.citationType}):
${citation.authors}. "${citation.title}" ${citation.journal}. ${citation.year}.
${links ? `[${links}]` : ''}

Key Findings:
${citation.keyFindings}
`;
  }).join('\n---\n');

  return `
CLINICAL EVIDENCE FOR ${drugName.toUpperCase()}:

${formattedCitations}

Please reference these citations when making efficacy or safety claims in your recommendation.
`;
}
