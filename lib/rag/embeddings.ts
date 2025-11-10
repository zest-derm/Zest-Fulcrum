import OpenAI from 'openai';
import { prisma } from '@/lib/db';

// Lazy initialization to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

/**
 * Generate embedding for a text string using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const openai = getOpenAI();
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Limit to 8000 chars to stay within token limits
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Chunk text into smaller pieces for better retrieval
 */
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Process and embed a knowledge document
 */
export async function embedKnowledgeDocument(
  title: string,
  content: string,
  category: string,
  sourceFile?: string,
  sourceUrl?: string
): Promise<string[]> {
  const chunks = chunkText(content);
  const documentIds: string[] = [];

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);

    // Store with raw SQL to handle vector type
    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "KnowledgeDocument" (
        id,
        title,
        content,
        embedding,
        category,
        "sourceFile",
        "sourceUrl",
        metadata,
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${title},
        ${chunk},
        ${embedding}::vector,
        ${category},
        ${sourceFile || null},
        ${sourceUrl || null},
        '{}'::jsonb,
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    if (result && result.length > 0) {
      documentIds.push(result[0].id);
    }
  }

  return documentIds;
}

/**
 * Search knowledge base using vector similarity
 *
 * @param query - The search query text
 * @param options - Search configuration
 * @param options.limit - Fixed number of chunks to retrieve (default: 5)
 * @param options.minSimilarity - Minimum similarity threshold (0-1). If set, retrieves dynamically based on relevance
 * @param options.maxResults - Maximum results when using minSimilarity (default: 10)
 * @param options.category - Optional category filter
 */
export async function searchKnowledge(
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    maxResults?: number;
    category?: string;
  }
): Promise<Array<{
  id: string;
  title: string;
  content: string;
  category: string;
  similarity: number;
}>> {
  const {
    limit = 5,
    minSimilarity,
    maxResults = 10,
    category
  } = options || {};

  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Use pgvector cosine distance for similarity search
  const categoryFilter = category ? `AND category = '${category}'` : '';

  // If using dynamic similarity-based retrieval, fetch more candidates
  const fetchLimit = minSimilarity !== undefined ? maxResults : limit;

  const results = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      id,
      title,
      content,
      category,
      "sourceFile",
      "sourceUrl",
      1 - (embedding <=> '${embeddingStr}'::vector) as similarity
    FROM "KnowledgeDocument"
    WHERE embedding IS NOT NULL
    ${categoryFilter}
    ORDER BY embedding <=> '${embeddingStr}'::vector
    LIMIT ${fetchLimit}
  `);

  let filteredResults = results.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    similarity: Number(r.similarity),
  }));

  // Apply similarity threshold if specified
  if (minSimilarity !== undefined) {
    filteredResults = filteredResults.filter(r => r.similarity >= minSimilarity);
  }

  return filteredResults;
}

/**
 * Legacy function for backward compatibility - uses fixed limit
 * @deprecated Use searchKnowledge with options object instead
 */
export async function searchKnowledgeLegacy(
  query: string,
  limit: number = 5,
  category?: string
): Promise<Array<{
  id: string;
  title: string;
  content: string;
  category: string;
  similarity: number;
}>> {
  return searchKnowledge(query, { limit, category });
}
