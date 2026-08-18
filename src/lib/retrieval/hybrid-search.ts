/**
 * Hybrid Retrieval Engine for ASTra.
 *
 * Implements Reciprocal Rank Fusion (RRF) to merge and rerank candidates from:
 * 1. Semantic Vector Search (Gemini text-embedding-004 embeddings)
 * 2. BM25 Lexical Search (wink-bm25 code-aware token index)
 *
 * Reciprocal Rank Fusion (RRF) Formula:
 *   RRF_Score(chunk) = 1 / (k + rank_semantic) + 1 / (k + rank_bm25)
 *
 * Where k is a smoothing constant (default: 60). Chunks appearing at top positions
 * in both searches receive the highest composite score.
 */

import { searchSemantic } from "./semantic-search";
import { searchBM25 } from "./bm25-search";
import { evaluateConfidence } from "./confidence";
import type {
  CodeChunk,
  HybridRetrievalResponse,
  HybridSearchOptions,
  RetrievalResult,
} from "@/types";

// Default RRF smoothing constant (standard benchmark default: 60)
const DEFAULT_RRF_K = 60;
const DEFAULT_TOP_K_CANDIDATES = 20;
const DEFAULT_TOP_N_FINAL = 8;

/**
 * Execute end-to-end Hybrid Search with Reciprocal Rank Fusion.
 *
 * @param queryText - Raw user query string.
 * @param repoId - Target repository identifier (e.g. "owner/repo").
 * @param options - Optional search limits and RRF parameters.
 */
export async function hybridRetrieve(
  queryText: string,
  repoId: string,
  options?: HybridSearchOptions
): Promise<HybridRetrievalResponse> {
  const startTime = performance.now();

  const topK = options?.topK ?? DEFAULT_TOP_K_CANDIDATES;
  const topN = options?.topN ?? DEFAULT_TOP_N_FINAL;
  const rrfK = options?.rrfK ?? DEFAULT_RRF_K;

  // 1. Run Semantic Vector Search & BM25 Keyword Search in parallel
  const [semanticResults, bm25Results] = await Promise.all([
    searchSemantic(queryText, repoId, topK),
    searchBM25(queryText, repoId, topK),
  ]);

  // 2. Perform Reciprocal Rank Fusion (RRF)
  const chunkMap = new Map<
    string,
    {
      chunk: CodeChunk;
      semanticRank?: number;
      bm25Rank?: number;
      rrfScore: number;
    }
  >();

  // Process Semantic candidates
  semanticResults.forEach((res, idx) => {
    const rank = idx + 1; // 1-indexed rank
    const scoreContribution = 1 / (rrfK + rank);

    chunkMap.set(res.chunk.id, {
      chunk: res.chunk,
      semanticRank: rank,
      rrfScore: scoreContribution,
    });
  });

  // Process BM25 candidates
  bm25Results.forEach((res, idx) => {
    const rank = idx + 1; // 1-indexed rank
    const scoreContribution = 1 / (rrfK + rank);

    const existing = chunkMap.get(res.chunk.id);
    if (existing) {
      existing.bm25Rank = rank;
      existing.rrfScore += scoreContribution; // Boost chunks present in both!
    } else {
      chunkMap.set(res.chunk.id, {
        chunk: res.chunk,
        bm25Rank: rank,
        rrfScore: scoreContribution,
      });
    }
  });

  // 3. Convert map to sorted RetrievalResult list
  const mergedList: RetrievalResult[] = Array.from(chunkMap.values()).map(
    (item) => {
      let source: RetrievalResult["source"] = "semantic";
      if (item.semanticRank && item.bm25Rank) {
        source = "hybrid";
      } else if (item.bm25Rank) {
        source = "bm25";
      }

      return {
        chunk: item.chunk,
        score: Number(item.rrfScore.toFixed(5)),
        source,
        semanticRank: item.semanticRank,
        bm25Rank: item.bm25Rank,
        rrfScore: Number(item.rrfScore.toFixed(5)),
      };
    }
  );

  // Sort descending by composite RRF score
  mergedList.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));

  // Slice top N results
  const finalResults = mergedList.slice(0, topN);

  // 4. Compute confidence signal
  const confidence = evaluateConfidence(finalResults);

  const elapsedMs = Math.round(performance.now() - startTime);

  return {
    query: queryText,
    repoId,
    results: finalResults,
    confidence,
    stats: {
      semanticCandidatesCount: semanticResults.length,
      bm25CandidatesCount: bm25Results.length,
      mergedCount: mergedList.length,
      latencyMs: elapsedMs,
    },
  };
}
