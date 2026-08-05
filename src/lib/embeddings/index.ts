/**
 * Embedding model wrapper for Ask My Codebase.
 *
 * Uses @xenova/transformers to run the all-MiniLM-L6-v2 model locally
 * via ONNX Runtime (WebAssembly). No API calls, no cost, ~25MB model
 * downloaded and cached on first use.
 *
 * Design decisions:
 * - Singleton pattern: The model is loaded once and reused. Loading takes
 *   1-3 seconds; subsequent calls are fast (~5-50ms per embedding).
 * - Why not Python sentence-transformers? Keeping everything in JS means
 *   one runtime, one deploy, no IPC overhead. The WASM-based model is
 *   ~2-3x slower than native ONNX, but for repo-scale data (thousands of
 *   chunks, not millions) this is negligible.
 * - Why all-MiniLM-L6-v2? It's the most popular lightweight embedding model,
 *   produces 384-dim vectors (small storage footprint), and has excellent
 *   quality for code search tasks. If we need better code-specific embeddings
 *   later, we can swap to `jinaai/jina-embeddings-v2-base-code` without
 *   changing the interface.
 */

import { pipeline, env } from "@xenova/transformers";
import os from "os";
import { loadEnv } from "@/lib/env";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

loadEnv();

// Set WASM threads to use CPU cores (leaving one free for the event loop)
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = Math.max(1, os.cpus().length - 1);
}

const DEFAULT_MODEL = process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";

// ---------------------------------------------------------------------------
// Singleton Model Instance
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPipeline: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadingPromise: Promise<any> | null = null;

/**
 * Lazily initialize the embedding pipeline. Thread-safe via promise caching —
 * concurrent calls during initial load will all await the same promise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExtractor(): Promise<any> {
  if (extractorPipeline) return extractorPipeline;

  if (!loadingPromise) {
    loadingPromise = pipeline("feature-extraction", DEFAULT_MODEL, {
      // Quantized model is smaller and faster to download/load.
      // Quality difference vs. fp32 is negligible for retrieval.
      quantized: true,
    }).then((pipe) => {
      extractorPipeline = pipe;
      return pipe;
    });
  }

  return loadingPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embed a single text string into a normalized vector.
 *
 * @param text - The text to embed (code snippet, query, etc.)
 * @returns A normalized embedding vector (Float64Array converted to number[]).
 *
 * @example
 * ```ts
 * const vec = await embedText("function login(user, pass) { ... }");
 * console.log(vec.length); // 384
 * ```
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed multiple texts in a batch. More efficient than calling embedText
 * in a loop because the model processes them together in a single WebAssembly matrix operation.
 *
 * @param texts - Array of text strings to embed.
 * @returns Array of embedding vectors, one per input text.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const results: number[][] = [];

  const output = await extractor(texts, {
    pooling: "mean",
    normalize: true,
  });

  const data = output.data as Float32Array;
  const dim = output.dims ? output.dims[1] : 384;

  for (let i = 0; i < texts.length; i++) {
    const slice = Array.from(data.subarray(i * dim, (i + 1) * dim));
    results.push(slice);
  }

  return results;
}

/**
 * Format a CodeChunk for embedding by combining file path, symbol metadata,
 * and content. Bare code snippets often lack context; adding file path and
 * symbol name improves semantic retrieval matches significantly.
 */
export function formatChunkForEmbedding(chunk: import("@/types").CodeChunk): string {
  const symbolHeader = chunk.symbolName
    ? `| ${chunk.symbolType || "symbol"}: ${chunk.symbolName}`
    : "";
  return `File: ${chunk.filePath} ${symbolHeader}\n\n${chunk.content}`;
}

/**
 * Batch embed CodeChunk objects with context enrichment.
 *
 * @param chunks - Array of CodeChunk objects.
 * @param batchSize - Batch size for pipeline processing (default: 32 for optimal WASM execution).
 * @returns Array of CodeChunk objects with their .embedding field populated.
 */
export async function embedChunks(
  chunks: import("@/types").CodeChunk[],
  batchSize = 32
): Promise<import("@/types").CodeChunk[]> {
  console.log(`\n🧠 Generating embeddings for ${chunks.length} chunks...`);
  const start = performance.now();

  const enrichedTexts = chunks.map(formatChunkForEmbedding);
  const embeddings: number[][] = [];

  for (let i = 0; i < enrichedTexts.length; i += batchSize) {
    const batch = enrichedTexts.slice(i, i + batchSize);
    const batchEmbeddings = await embedBatch(batch);
    embeddings.push(...batchEmbeddings);

    const progress = Math.min(i + batchSize, chunks.length);
    if (chunks.length > 20 && (progress % 32 === 0 || progress === chunks.length)) {
      console.log(`   Embedded ${progress}/${chunks.length} chunks...`);
    }
  }

  const elapsedMs = Math.round(performance.now() - start);
  console.log(
    `   Generated ${embeddings.length} embeddings in ${elapsedMs}ms (${(
      elapsedMs / (chunks.length || 1)
    ).toFixed(1)}ms/chunk)`
  );

  return chunks.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx],
  }));
}

/**
 * Get the configured model name. Useful for health checks and logging.
 */
export function getModelName(): string {
  return DEFAULT_MODEL;
}

/**
 * Get the embedding dimension for the current model.
 * Must be called after at least one embed call (model must be loaded).
 */
export async function getEmbeddingDimension(): Promise<number> {
  const testVec = await embedText("dimension probe");
  return testVec.length;
}
