import { loadEnv } from "@/lib/env";
import type { CodeChunk } from "@/types";

loadEnv();

export type EmbeddingProvider = "local" | "gemini";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_BATCH_SIZE = 20;
const DEFAULT_LOCAL_BATCH_SIZE = 64;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Provider & Configuration
// ---------------------------------------------------------------------------

export function getEmbeddingProvider(): EmbeddingProvider {
  loadEnv();
  const raw = (process.env.EMBEDDING_PROVIDER || "").toLowerCase().trim();
  if (raw === "gemini" || raw === "google") {
    return "gemini";
  }
  if (raw === "local" || raw === "onnx" || raw === "xenova") {
    return "local";
  }
  // Default to local for zero rate-limit & unlimited chunk throughput
  return "local";
}

function getGeminiApiKey(): string {
  loadEnv();
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || key.startsWith("your_")) {
    throw new Error(
      "GEMINI_API_KEY environment variable is missing or placeholder. " +
        "Please get a free API key at https://aistudio.google.com/ and add GEMINI_API_KEY=your_key to your .env.local file, or switch to EMBEDDING_PROVIDER=local."
    );
  }
  return key;
}

function normalizeGeminiModel(rawModel: string): string {
  const trimmed = rawModel.trim();
  if (trimmed === "text-embedding-004" || trimmed === "models/text-embedding-004") {
    return "models/gemini-embedding-001";
  }
  return trimmed.startsWith("models/") ? trimmed : `models/${trimmed}`;
}

export function getPrimaryGeminiModel(): string {
  loadEnv();
  return normalizeGeminiModel(process.env.EMBEDDING_MODEL || "gemini-embedding-001");
}

export function getFallbackGeminiModel(): string {
  const primary = getPrimaryGeminiModel();
  return primary.includes("gemini-embedding-2")
    ? "models/gemini-embedding-001"
    : "models/gemini-embedding-2";
}

// ---------------------------------------------------------------------------
// 1. Local ONNX Embedding Engine (@xenova/transformers)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localExtractorInstance: any = null;
let localExtractorPromise: Promise<unknown> | null = null;

async function getLocalExtractor() {
  if (localExtractorInstance) return localExtractorInstance;

  if (!localExtractorPromise) {
    localExtractorPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      localExtractorInstance = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
      return localExtractorInstance;
    })();
  }

  return localExtractorPromise;
}

async function embedTextLocal(text: string): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractor: any = await getLocalExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

async function embedBatchLocal(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractor: any = await getLocalExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });

  const dim = 384;
  const vectors: number[][] = [];
  const rawData: Float32Array = output.data;

  for (let i = 0; i < texts.length; i++) {
    const start = i * dim;
    const end = start + dim;
    vectors.push(Array.from(rawData.slice(start, end)));
  }

  return vectors;
}

// ---------------------------------------------------------------------------
// 2. Google Gemini API Cloud Embedding Engine
// ---------------------------------------------------------------------------

function extractRetryDelayMs(errorData: unknown, defaultDelayMs = 2000): number {
  try {
    const parsed = typeof errorData === "string" ? JSON.parse(errorData) : errorData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retryInfo = parsed?.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo") && d.retryDelay);
    if (retryInfo?.retryDelay) {
      const sec = parseFloat(retryInfo.retryDelay);
      if (!isNaN(sec) && sec > 0) {
        return Math.min(Math.ceil(sec * 1000) + 500, 60000);
      }
    }
    const msg = parsed?.error?.message || "";
    const match = /retry in ([\d.]+)s/i.exec(msg);
    if (match) {
      const sec = parseFloat(match[1]);
      if (!isNaN(sec) && sec > 0) {
        return Math.min(Math.ceil(sec * 1000) + 500, 60000);
      }
    }
  } catch {
    // ignore parse error
  }
  return defaultDelayMs;
}

async function embedTextGemini(text: string): Promise<number[]> {
  const apiKey = getGeminiApiKey();
  let currentModel = getPrimaryGeminiModel();
  const fallbackModel = getFallbackGeminiModel();

  let attempt = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (attempt < MAX_RETRIES) {
    const url = `${GEMINI_API_BASE}/${currentModel}:embedContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentModel,
          content: {
            parts: [{ text }],
          },
          outputDimensionality: 768,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.embedding?.values) {
          return data.embedding.values;
        }
        throw new Error("Invalid response format received from Gemini Embedding API");
      }

      const errorText = await res.text();
      const isRateLimit = res.status === 429 || errorText.includes("RESOURCE_EXHAUSTED") || errorText.includes("quota");

      if (isRateLimit && currentModel !== fallbackModel) {
        console.warn(`⚠️ Gemini Rate Limit / Quota for ${currentModel}. Switching to fallback model: ${fallbackModel}...`);
        currentModel = fallbackModel;
        attempt++;
        continue;
      }

      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Gemini Embedding API failed (${res.status}): ${errorText}`);
      }

      const parsedDelay = extractRetryDelayMs(errorText, delay);
      console.warn(`Warning: Gemini embedContent attempt ${attempt} failed (${res.status}). Retrying in ${parsedDelay}ms...`);
      await sleep(parsedDelay);
      delay = Math.min(delay * 2, 30000);
    } catch (err: unknown) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }

  throw new Error("Gemini embedText invocation failed after retries.");
}

async function embedBatchGemini(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = getGeminiApiKey();
  let currentModel = getPrimaryGeminiModel();
  const fallbackModel = getFallbackGeminiModel();

  let attempt = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (attempt < MAX_RETRIES) {
    const url = `${GEMINI_API_BASE}/${currentModel}:batchEmbedContents?key=${apiKey}`;

    const requests = texts.map((t) => ({
      model: currentModel,
      content: {
        parts: [{ text: t }],
      },
      outputDimensionality: 768,
    }));

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.embeddings && Array.isArray(data.embeddings)) {
          return data.embeddings.map((e: { values: number[] }) => e.values);
        }
        throw new Error("Invalid response structure from Gemini batchEmbedContents API");
      }

      const errorText = await res.text();
      const isRateLimit = res.status === 429 || errorText.includes("RESOURCE_EXHAUSTED") || errorText.includes("quota");

      if (isRateLimit && currentModel !== fallbackModel) {
        console.warn(`⚠️ Gemini Rate Limit / Quota for ${currentModel}. Switching to fallback model: ${fallbackModel}...`);
        currentModel = fallbackModel;
        attempt++;
        continue;
      }

      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Gemini Batch Embedding API failed (${res.status}): ${errorText}`);
      }

      const parsedDelay = extractRetryDelayMs(errorText, delay);
      console.warn(`Warning: Gemini batchEmbedContents attempt ${attempt} failed (${res.status}). Retrying in ${parsedDelay}ms...`);
      await sleep(parsedDelay);
      delay = Math.min(delay * 2, 30000);
    } catch (err: unknown) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }

  throw new Error("Gemini batchEmbedContents invocation failed after retries.");
}

// ---------------------------------------------------------------------------
// 3. Unified Public Embedding API
// ---------------------------------------------------------------------------

/**
 * Format a CodeChunk for embedding with file path and symbol metadata.
 */
export function formatChunkForEmbedding(chunk: CodeChunk): string {
  const symbolHeader = chunk.symbolName
    ? `| ${chunk.symbolType || "symbol"}: ${chunk.symbolName}`
    : "";
  return `File: ${chunk.filePath} ${symbolHeader}\n\n${chunk.content}`;
}

/**
 * Embed a single text string using the configured provider (local ONNX or Gemini Cloud).
 */
export async function embedText(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  if (provider === "local") {
    return embedTextLocal(text);
  }
  return embedTextGemini(text);
}

/**
 * Embed multiple texts using the configured provider.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const provider = getEmbeddingProvider();
  if (provider === "local") {
    return embedBatchLocal(texts);
  }
  return embedBatchGemini(texts);
}

/**
 * Batch embed CodeChunk objects with context enrichment and pacing.
 */
export async function embedChunks(
  chunks: CodeChunk[],
  batchSizeOverride?: number
): Promise<CodeChunk[]> {
  const provider = getEmbeddingProvider();
  const batchSize =
    batchSizeOverride ??
    (provider === "local" ? DEFAULT_LOCAL_BATCH_SIZE : DEFAULT_GEMINI_BATCH_SIZE);

  console.log(
    `\n🧠 Generating embeddings via [${provider.toUpperCase()} (${getModelName()})] for ${chunks.length} chunks (batch size: ${batchSize})...`
  );
  const start = performance.now();

  const enrichedTexts = chunks.map(formatChunkForEmbedding);
  const embeddings: number[][] = [];

  for (let i = 0; i < enrichedTexts.length; i += batchSize) {
    const batch = enrichedTexts.slice(i, i + batchSize);
    const batchEmbeddings = await embedBatch(batch);
    embeddings.push(...batchEmbeddings);

    const progress = Math.min(i + batchSize, chunks.length);
    console.log(`   Embedded ${progress}/${chunks.length} chunks via ${provider}...`);

    // In Gemini mode, add 200ms pacing delay between batches to stay within rate limits
    if (provider === "gemini" && i + batchSize < enrichedTexts.length) {
      await sleep(200);
    }
  }

  const elapsedMs = Math.round(performance.now() - start);
  console.log(
    `   ⚡ Generated ${embeddings.length} ${provider} embeddings in ${elapsedMs}ms (${(
      elapsedMs / (chunks.length || 1)
    ).toFixed(1)}ms/chunk)`
  );

  return chunks.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx],
  }));
}

/**
 * Get the active model identifier name.
 */
export function getModelName(): string {
  const provider = getEmbeddingProvider();
  if (provider === "local") {
    return "Xenova/all-MiniLM-L6-v2";
  }
  return getPrimaryGeminiModel();
}

/**
 * Get the embedding vector dimension for the active provider.
 */
export async function getEmbeddingDimension(): Promise<number> {
  const provider = getEmbeddingProvider();
  return provider === "local" ? 384 : 768;
}

