/**
 * Confidence Signal Evaluator for ASTra Hybrid Retrieval Engine.
 *
 * Computes a simple, explainable confidence score for the retrieved chunk set.
 * Used by Phase 3 Generation to determine whether the retrieved context is strong
 * enough for an answer, or if the system should respond "I don't know" to prevent
 * hallucinations.
 */

import type { ConfidenceSignal, RetrievalResult } from "@/types";

// Minimum RRF score threshold required for acceptable confidence (0.010 allows top 20 candidate hits)
const MIN_RRF_SCORE_THRESHOLD = 0.010;

/**
 * Evaluate retrieval results and generate a confidence assessment.
 *
 * @param results - Ranked list of merged RetrievalResult objects.
 * @param semanticCount - Number of candidates returned by semantic search.
 * @param bm25Count - Number of candidates returned by BM25 search.
 * @returns ConfidenceSignal with numeric score, lowConfidence boolean flag, and rationale.
 */
export function evaluateConfidence(
  results: RetrievalResult[],
  semanticCount: number,
  bm25Count: number
): ConfidenceSignal {
  // Case 1: No chunks retrieved
  if (results.length === 0) {
    return {
      score: 0,
      lowConfidence: true,
      reason: "No relevant code chunks found in the repository for this query.",
    };
  }

  const topHit = results[0];
  const rrfScore = topHit.rrfScore || 0;

  // Case 2: RRF score below minimum threshold
  if (rrfScore < MIN_RRF_SCORE_THRESHOLD) {
    return {
      score: Number(rrfScore.toFixed(4)),
      lowConfidence: true,
      reason: `Top retrieval score (${rrfScore.toFixed(4)}) is below threshold (${MIN_RRF_SCORE_THRESHOLD}). Context may be weak.`,
    };
  }

  // Case 3: Top candidate confirmed by both semantic & BM25 search (Hybrid match)
  if (topHit.source === "hybrid") {
    return {
      score: Number(Math.min(1.0, rrfScore * 30).toFixed(4)),
      lowConfidence: false,
      reason: `High confidence: Top candidate "${topHit.chunk.filePath}:${topHit.chunk.startLine}" matched by both semantic vectors and BM25 keywords.`,
    };
  }

  // Case 4: Strong single-source match
  const scoreGap = results.length > 1 ? rrfScore - (results[1].rrfScore || 0) : rrfScore;
  const isDominant = scoreGap > 0.003;

  return {
    score: Number(Math.min(1.0, rrfScore * 25).toFixed(4)),
    lowConfidence: false,
    reason: isDominant
      ? `Good confidence: Clear top match in ${topHit.source} search.`
      : `Moderate confidence: Candidate found via ${topHit.source} search.`,
  };
}
