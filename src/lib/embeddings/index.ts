/**
 * Embedding model module for ASTra.
 *
 * Uses Google Gemini API (text-embedding-004) for ultra-fast, cloud-accelerated
 * semantic embeddings (768-dim normalized vectors).
 *
 * Features:
 * - Up to 100 chunks batched per single HTTP request (via batchEmbedContents)
 * - Sub-second latency (~200ms-500ms for 100 chunks)
 * - 100% Free via Google AI Studio (https://aistudio.google.com)
 */

import { loadEnv } from "@/lib/env";
import type { CodeChunk } from "@/types";

loadEnv();

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string {
  loadEnv();
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || key.startsWith("your_")) {
    throw new Error(
      "GEMINI_API_KEY environment variable is missing or placeholder. " +
        "Please get a free API key at https://aistudio.google.com/ and add GEMINI_API_KEY=your_key to your .env.local file."
    );
  }
  return key;
}

function getEmbeddingModel(): string {
  loadEnv();
  const rawModel = process.env.EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
  if (rawModel === "text-embedding-004" || rawModel === "models/text-embedding-004") {
    return "models/gemini-embedding-001";
  }
  return rawModel.startsWith("models/") ? rawModel : `models/${rawModel}`;
}

/**
 * Embed a single text string into a normalized 768-dim vector using Gemini API.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const modelName = getEmbeddingModel();

  const url = `${GEMINI_API_BASE}/${modelName}:embedContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      content: {
        parts: [{ text }],
      },
      outputDimensionality: 768,
    }),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Gemini Embedding API call failed (${res.status}): ${errorData}`);
  }

  const data = await res.json();
  if (!data.embedding?.values) {
    throw new Error("Invalid response format received from Gemini Embedding API");
  }

  return data.embedding.values;
}

/**
 * Embed multiple texts in batches of up to 100 texts using batchEmbedContents.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = getApiKey();
  const modelName = getEmbeddingModel();

  const url = `${GEMINI_API_BASE}/${modelName}:batchEmbedContents?key=${apiKey}`;

  const requests = texts.map((t) => ({
    model: modelName,
    content: {
      parts: [{ text: t }],
    },
    outputDimensionality: 768,
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Gemini Batch Embedding API failed (${res.status}): ${errorData}`);
  }

  const data = await res.json();
  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error("Invalid response structure from Gemini batchEmbedContents API");
  }

  return data.embeddings.map((e: { values: number[] }) => e.values);
}

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
 * Batch embed CodeChunk objects with context enrichment.
 * Batches are processed in chunks of 100 (the maximum allowed by Gemini batchEmbedContents).
 */
export async function embedChunks(
  chunks: CodeChunk[],
  batchSize = 100
): Promise<CodeChunk[]> {
  console.log(`\n🧠 Generating Gemini embeddings for ${chunks.length} chunks...`);
  const start = performance.now();

  const enrichedTexts = chunks.map(formatChunkForEmbedding);
  const embeddings: number[][] = [];

  for (let i = 0; i < enrichedTexts.length; i += batchSize) {
    const batch = enrichedTexts.slice(i, i + batchSize);
    const batchEmbeddings = await embedBatch(batch);
    embeddings.push(...batchEmbeddings);

    const progress = Math.min(i + batchSize, chunks.length);
    console.log(`   Embedded ${progress}/${chunks.length} chunks via Gemini...`);
  }

  const elapsedMs = Math.round(performance.now() - start);
  console.log(
    `   ⚡ Generated ${embeddings.length} Gemini embeddings in ${elapsedMs}ms (${(
      elapsedMs / (chunks.length || 1)
    ).toFixed(1)}ms/chunk)`
  );

  return chunks.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx],
  }));
}

/**
 * Get the configured model name.
 */
export function getModelName(): string {
  return getEmbeddingModel();
}

/**
 * Get the embedding dimension for the current model.
 */
export async function getEmbeddingDimension(): Promise<number> {
  const testVec = await embedText("dimension probe");
  return testVec.length;
}
