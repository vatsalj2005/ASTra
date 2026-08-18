/**
 * Semantic Vector Search Module for ASTra.
 *
 * Converts a natural-language query string into a 768-dimensional embedding
 * using Google Gemini (text-embedding-004) and queries nearest-neighbor code chunks
 * from the vector store via Cosine Similarity.
 */

import { embedText } from "@/lib/embeddings";
import { querySimilarChunks } from "@/lib/vector-store";
import type { RetrievalResult } from "@/types";

/**
 * Execute semantic vector search for a natural language query against an ingested repo.
 *
 * @param queryText - Raw user question or query string.
 * @param repoId - Target repository identifier (e.g. "owner/repo").
 * @param topK - Number of top candidate chunks to retrieve (default: 20).
 * @returns Array of RetrievalResult objects ranked by vector similarity.
 */
export async function searchSemantic(
  queryText: string,
  repoId: string,
  topK = 20
): Promise<RetrievalResult[]> {
  if (!queryText.trim()) return [];

  // 1. Embed query using same local model (all-MiniLM-L6-v2) as Phase 1
  const queryVector = await embedText(queryText);

  // 2. Query nearest neighbor chunks from vector store
  const chunks = await querySimilarChunks(queryVector, topK, repoId);

  // 3. Map to RetrievalResult with rank and score
  return chunks.map((chunk, idx) => ({
    chunk,
    score: 1 / (1 + idx), // Normalized relative score based on rank position
    source: "semantic",
    semanticRank: idx + 1,
  }));
}
