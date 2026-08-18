/**
 * Multi-Hop Reference Retrieval Module for ASTra.
 *
 * Provides secondary retrieval pass capabilities when a generated answer
 * (Phase 3) references another symbol or file path that was not present in the
 * initial retrieved chunk set.
 */

import { searchBM25 } from "./bm25-search";
import { querySimilarChunks } from "@/lib/vector-store";
import { getEmbeddingDimension } from "@/lib/embeddings";
import type { RetrievalResult } from "@/types";

/**
 * Retrieve code chunks by exact or partial symbol name or file path reference.
 *
 * @param symbolOrFilePath - Symbol name (e.g. "verifyJwtToken") or file path (e.g. "src/auth/jwt.ts").
 * @param repoId - Target repository identifier.
 * @param topK - Top results to return (default: 5).
 */
export async function retrieveByReference(
  symbolOrFilePath: string,
  repoId: string,
  topK = 5
): Promise<RetrievalResult[]> {
  if (!symbolOrFilePath.trim()) return [];

  // 1. First attempt exact BM25 symbol/file match
  const bm25Hits = await searchBM25(symbolOrFilePath, repoId, topK);

  // Filter for exact symbol name or file path hits
  const exactHits = bm25Hits.filter((hit) => {
    const sym = hit.chunk.symbolName?.toLowerCase() || "";
    const path = hit.chunk.filePath.toLowerCase();
    const query = symbolOrFilePath.toLowerCase();
    return sym === query || path.includes(query);
  });

  if (exactHits.length > 0) {
    return exactHits.slice(0, topK);
  }

  // 2. Fallback: Search all chunks for matching file path or symbol
  const dim = await getEmbeddingDimension();
  const dummyZeroVec = new Array(dim).fill(0);
  const allChunks = await querySimilarChunks(dummyZeroVec, 1000, repoId);

  const matchedChunks = allChunks.filter((chunk) => {
    const sym = chunk.symbolName?.toLowerCase() || "";
    const p = chunk.filePath.toLowerCase();
    const query = symbolOrFilePath.toLowerCase();
    return sym.includes(query) || p.includes(query);
  });

  return matchedChunks.slice(0, topK).map((chunk, idx) => ({
    chunk,
    score: 1 / (1 + idx),
    source: "bm25",
  }));
}
