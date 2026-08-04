/**
 * Shared TypeScript types for Ask My Codebase.
 *
 * These types define the core data model that flows through the pipeline:
 *   Ingestion → Retrieval → Generation → Frontend
 *
 * Design note: Types are intentionally kept in a single file during early
 * development. As the project grows, they can be split into domain-specific
 * files (e.g., ingestion.ts, retrieval.ts) within this directory.
 */

// ---------------------------------------------------------------------------
// Ingestion Types
// ---------------------------------------------------------------------------

/**
 * A semantically meaningful chunk of source code, extracted by tree-sitter.
 *
 * Unlike naive character-count chunking, each CodeChunk corresponds to a
 * real code boundary (function, class, method, or top-level module block).
 * This preserves semantic coherence — a retrieval hit returns a complete,
 * understandable unit of code, not a fragment split mid-expression.
 */
export interface CodeChunk {
  /** Unique identifier (e.g., `${repoId}:${filePath}:${startLine}`). */
  id: string;

  /** Repository identifier (owner/repo or URL hash). */
  repoId: string;

  /** Relative file path within the repository (e.g., "src/auth/login.ts"). */
  filePath: string;

  /** Programming language (e.g., "javascript", "python", "typescript"). */
  language: string;

  /** The raw source code of this chunk. */
  content: string;

  /** 1-indexed start line in the original file. */
  startLine: number;

  /** 1-indexed end line in the original file (inclusive). */
  endLine: number;

  /** Name of the function/class/method, if applicable. */
  symbolName?: string;

  /** What kind of code construct this chunk represents. */
  symbolType?: "function" | "class" | "method" | "module" | "doc";

  /**
   * Embedding vector, populated during ingestion.
   * Stored separately in the vector DB; included here for pipeline convenience.
   */
  embedding?: number[];
}

/**
 * Configurable rules for filtering files during repository ingestion.
 */
export interface FilterConfig {
  /** Directories to exclude (e.g. node_modules, .git, dist). */
  ignoredDirectories?: string[];

  /** File extensions to exclude (e.g. .lock, .png, .exe). */
  ignoredExtensions?: string[];

  /** Exact filenames to exclude (e.g. package-lock.json). */
  ignoredFilenames?: string[];

  /** Extensions considered source code for parsing. */
  allowedCodeExtensions?: string[];

  /** Exact doc filenames to include (e.g. README.md). */
  allowedDocFilenames?: string[];

  /** Doc extensions to include (e.g. .md, .mdx). */
  allowedDocExtensions?: string[];

  /** Maximum file size in bytes to include (default: 500 KB). */
  maxFileSizeBytes?: number;
}

/**
 * Results returned by the ingestion pipeline.
 */
export interface IngestionResult {
  /** Unique repository identifier (e.g., owner/repo). */
  repoId: string;

  /** Total number of files processed. */
  fileCount: number;

  /** Total number of chunks extracted and stored. */
  chunkCount: number;

  /** Languages detected in the processed repository. */
  languages: string[];

  /** Processing latency in milliseconds. */
  timeTakenMs: number;

  /** Summary of chunks grouped by symbolType. */
  chunkSummary: {
    functions: number;
    classes: number;
    methods: number;
    modules: number;
    docs: number;
  };
}

/**
 * Metadata about an ingested repository.
 */
export interface RepoMetadata {
  /** Unique identifier (owner/repo). */
  id: string;

  /** Full GitHub URL. */
  url: string;

  /** Default branch name. */
  defaultBranch: string;

  /** Total number of chunks extracted. */
  chunkCount: number;

  /** Total number of files processed. */
  fileCount: number;

  /** Languages detected in the repository. */
  languages: string[];

  /** ISO timestamp of when ingestion completed. */
  ingestedAt: string;
}

// ---------------------------------------------------------------------------
// Retrieval Types
// ---------------------------------------------------------------------------

/**
 * A single retrieval result from hybrid search.
 *
 * Design note: We track the `source` so the frontend can show users whether
 * a result came from semantic similarity, keyword match, or both (merged).
 * This transparency is part of the "no hallucination" philosophy — users
 * can see *why* a chunk was retrieved.
 */
export interface RetrievalResult {
  /** The retrieved code chunk. */
  chunk: CodeChunk;

  /** Relevance score (0–1, higher is better). Normalized after fusion. */
  score: number;

  /** Which retrieval path found this chunk. */
  source: "semantic" | "bm25" | "hybrid";

  /** Rank position in vector similarity search (1-indexed), if present. */
  semanticRank?: number;

  /** Rank position in BM25 keyword search (1-indexed), if present. */
  bm25Rank?: number;

  /** Calculated Reciprocal Rank Fusion (RRF) score. */
  rrfScore?: number;
}

/**
 * Confidence evaluation for retrieval results to prevent LLM hallucinations.
 */
export interface ConfidenceSignal {
  /** Top result score or composite confidence metric. */
  score: number;

  /** Flag indicating low retrieval confidence (should respond "I don't know"). */
  lowConfidence: boolean;

  /** Human-readable rationale for confidence assessment. */
  reason: string;
}

/**
 * Options for configuring hybrid retrieval.
 */
export interface HybridSearchOptions {
  /** Candidates to fetch per retrieval path before fusion (default: 20). */
  topK?: number;

  /** Final top ranked chunks to return (default: 8). */
  topN?: number;

  /** RRF smoothing constant k (default: 60). */
  rrfK?: number;
}

/**
 * Complete response returned by the hybrid retrieval engine.
 */
export interface HybridRetrievalResponse {
  /** Raw user query. */
  query: string;

  /** Target repository identifier. */
  repoId: string;

  /** Final merged & ranked list of chunks. */
  results: RetrievalResult[];

  /** Confidence assessment of retrieval relevance. */
  confidence: ConfidenceSignal;

  /** Performance and search count breakdown. */
  stats: {
    semanticCandidatesCount: number;
    bm25CandidatesCount: number;
    mergedCount: number;
    latencyMs: number;
  };
}

// ---------------------------------------------------------------------------
// Generation Types
// ---------------------------------------------------------------------------

/**
 * A citation linking a claim in the AI's answer to a specific code location.
 */
export interface Citation {
  /** Relative file path. */
  filePath: string;

  /** Start line of the cited code. */
  startLine: number;

  /** End line of the cited code (inclusive). */
  endLine: number;

  /** The code snippet that supports the claim. */
  snippet: string;
}

/**
 * A complete answer from the generation pipeline.
 */
export interface GeneratedAnswer {
  /** The natural-language answer text (may contain inline citation markers). */
  text: string;

  /** Structured citations referenced in the answer. */
  citations: Citation[];

  /** The chunks that were injected into the LLM context. */
  retrievedChunks: RetrievalResult[];

  /** Confidence indicator — if retrieval quality is low, this is true. */
  lowConfidence: boolean;

  /** Model used for generation (e.g., "llama-3.3-70b-versatile"). */
  model: string;

  /** Generation latency in milliseconds. */
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Health Check Types
// ---------------------------------------------------------------------------

/**
 * Response shape for the /api/health endpoint.
 */
export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    nextjs: boolean;
    embedding: {
      ok: boolean;
      model?: string;
      dimension?: number;
      latencyMs?: number;
      error?: string;
    };
    treeSitter: {
      ok: boolean;
      languages?: string[];
      testNodeCount?: number;
      error?: string;
    };
  };
}
