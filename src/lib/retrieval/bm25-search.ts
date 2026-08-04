/**
 * BM25 Keyword Search Module for ASTra.
 *
 * Implements code-aware Okapi BM25 ranking algorithm with field boosting
 * for symbol names and file paths.
 *
 * Why BM25 Keyword Search is Essential alongside Vector Search:
 * - Semantic vector search catches conceptual similarity ("how do users log in?")
 *   but struggles with exact symbol names, specific method names, or unique error strings.
 * - BM25 lexical search finds exact code identifiers (e.g. `handleOAuth2CallbackV2`,
 *   `paginate.hasPreviousPages`, `MAX_BUFFER_SIZE`) with 100% precision.
 * - Combining both via Reciprocal Rank Fusion (RRF) delivers production-grade RAG precision.
 */

import { getAllRepoChunks } from "@/lib/vector-store";
import type { CodeChunk, RetrievalResult } from "@/types";

// ---------------------------------------------------------------------------
// Code-Aware Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize source code text into normalized word tokens.
 * Splits camelCase, snake_case, dot notation, and non-alphanumeric delimiters,
 * while ALSO preserving the full raw identifier.
 *
 * Example: "paginate.hasPreviousPages" -> ["paginate.haspreviouspages", "paginate", "haspreviouspages", "has", "previous", "pages"]
 */
export function tokenizeCode(text: string): string[] {
  if (!text) return [];

  const rawLower = text.toLowerCase();

  // 1. Extract raw words (e.g., "paginate.haspreviouspages")
  const rawWords = rawLower.split(/[\s,;(){}\[\]"'\r\n]+/).filter((w) => w.length > 1);

  // 2. Expand camelCase words (e.g., "hasPreviousPages" -> "has Previous Pages")
  const expanded = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const subTokens = expanded.toLowerCase().split(/[^a-z0-9_$]+/).filter((w) => w.length > 1);

  const tokenSet = new Set<string>([...rawWords, ...subTokens]);
  return Array.from(tokenSet);
}

// ---------------------------------------------------------------------------
// Okapi BM25 Engine Implementation
// ---------------------------------------------------------------------------

class BM25Engine {
  private k1 = 1.2;
  private b = 0.75;

  private chunks: CodeChunk[];
  private docTokens: Map<number, string[]>;
  private docLengths: Map<number, number>;
  private termFrequencies: Map<number, Map<string, number>>;
  private docFrequencies: Map<string, number>;
  private avgDocLength = 0;
  private numDocs = 0;

  constructor(chunks: CodeChunk[]) {
    this.chunks = chunks;
    this.numDocs = chunks.length;
    this.docTokens = new Map();
    this.docLengths = new Map();
    this.termFrequencies = new Map();
    this.docFrequencies = new Map();

    this.buildIndex();
  }

  private buildIndex() {
    let totalLength = 0;

    this.chunks.forEach((chunk, docId) => {
      // Field-weighted token extraction
      const contentTokens = tokenizeCode(chunk.content);
      const pathTokens = tokenizeCode(chunk.filePath);
      const symbolTokens = chunk.symbolName ? tokenizeCode(chunk.symbolName) : [];

      const tfMap = new Map<string, number>();

      // Weighting: content = 1.0, filePath = 2.0, symbolName = 4.0
      const addWeightedToken = (token: string, weight: number) => {
        const count = tfMap.get(token) || 0;
        tfMap.set(token, count + weight);
      };

      contentTokens.forEach((t) => addWeightedToken(t, 1.0));
      pathTokens.forEach((t) => addWeightedToken(t, 2.0));
      symbolTokens.forEach((t) => addWeightedToken(t, 4.0));

      const docLen = tfMap.size;
      totalLength += docLen;

      this.docLengths.set(docId, docLen);
      this.termFrequencies.set(docId, tfMap);

      // Track document frequencies (count of docs containing token)
      tfMap.forEach((_, token) => {
        const df = this.docFrequencies.get(token) || 0;
        this.docFrequencies.set(token, df + 1);
      });
    });

    this.avgDocLength = this.numDocs > 0 ? totalLength / this.numDocs : 0;
  }

  public search(queryText: string, topK = 20): RetrievalResult[] {
    const queryTokens = tokenizeCode(queryText);
    if (queryTokens.length === 0 || this.numDocs === 0) return [];

    const scores = new Map<number, number>();

    queryTokens.forEach((token) => {
      const df = this.docFrequencies.get(token) || 0;
      if (df === 0) return;

      // Okapi BM25 Inverse Document Frequency (IDF)
      const idf = Math.log(
        (this.numDocs - df + 0.5) / (df + 0.5) + 1.0
      );

      this.termFrequencies.forEach((tfMap, docId) => {
        const tf = tfMap.get(token);
        if (!tf || tf === 0) return;

        const docLen = this.docLengths.get(docId) || this.avgDocLength;
        const normLen = 1.0 - this.b + this.b * (docLen / (this.avgDocLength || 1));

        // Okapi BM25 Score formula
        const termScore = idf * ((tf * (this.k1 + 1.0)) / (tf + this.k1 * normLen));

        const currentScore = scores.get(docId) || 0;
        scores.set(docId, currentScore + termScore);
      });
    });

    // Sort document candidates descending by BM25 score
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

    return sorted.slice(0, topK).map(([docId, score], idx) => ({
      chunk: this.chunks[docId],
      score: Number(score.toFixed(4)),
      source: "bm25",
      bm25Rank: idx + 1,
    }));
  }
}

// ---------------------------------------------------------------------------
// BM25 Index Cache (Per Repository)
// ---------------------------------------------------------------------------

const bm25Cache = new Map<string, BM25Engine>();

/**
 * Get or build in-memory BM25 index for a given repository.
 */
async function getOrBuildBM25Index(repoId: string): Promise<BM25Engine | null> {
  const cached = bm25Cache.get(repoId);
  if (cached) return cached;

  const chunks = await getAllRepoChunks(repoId);
  if (chunks.length === 0) return null;

  const engine = new BM25Engine(chunks);
  bm25Cache.set(repoId, engine);
  return engine;
}

/**
 * Clear in-memory BM25 index cache for a repository.
 */
export function clearBM25Cache(repoId?: string): void {
  if (repoId) {
    bm25Cache.delete(repoId);
  } else {
    bm25Cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Public Search API
// ---------------------------------------------------------------------------

/**
 * Execute BM25 lexical keyword search for a query string.
 *
 * @param queryText - Raw user query string.
 * @param repoId - Target repository identifier.
 * @param topK - Top candidates to return (default: 20).
 */
export async function searchBM25(
  queryText: string,
  repoId: string,
  topK = 20
): Promise<RetrievalResult[]> {
  if (!queryText.trim()) return [];

  const engine = await getOrBuildBM25Index(repoId);
  if (!engine) return [];

  return engine.search(queryText, topK);
}
