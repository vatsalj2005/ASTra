/**
 * Vector Store Module for ASTra Ingestion & Retrieval.
 *
 * Provides a hybrid storage layer:
 * 1. Primary: ChromaDB client (if server is running at CHROMA_URL).
 * 2. Fallback: File-backed local vector store (tmp/astra-vectors.json) with exact
 *    cosine similarity vector search.
 *
 * This dual approach ensures zero-friction local development without requiring
 * developers to launch a background ChromaDB process, while remaining fully
 * compatible with production vector stores.
 */

import fs from "fs";
import path from "path";
import type { CodeChunk } from "@/types";

import { loadEnv } from "@/lib/env";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

loadEnv();

const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";
const COLLECTION_NAME = "astra_chunks";
const LOCAL_STORE_FILE = path.resolve(process.cwd(), "tmp", "astra-vectors.json");

/**
 * Custom dummy embedding function to prevent ChromaDB from requiring
 * @chroma-core/default-embed or downloading external models.
 */
const noopEmbeddingFunction = {
  generate: async (texts: string[]): Promise<number[][]> => {
    return texts.map(() => []);
  },
};

// ---------------------------------------------------------------------------
// In-Memory / File-backed Vector Store Fallback
// ---------------------------------------------------------------------------

interface LocalStoredChunk {
  id: string;
  repoId: string;
  filePath: string;
  language: string;
  content: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  symbolType?: CodeChunk["symbolType"];
  embedding: number[];
}

function loadLocalStore(): LocalStoredChunk[] {
  if (!fs.existsSync(LOCAL_STORE_FILE)) return [];
  try {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalStore(chunks: LocalStoredChunk[]): void {
  try {
    const dir = path.dirname(LOCAL_STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(chunks, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write to local vector store file:", err);
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// Singleton Connection Management
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedCollection: any = null;
let isChromaAvailable: boolean | null = null;

function getChromaModule() {
  try {
    // eslint-disable-next-line no-eval
    return eval('require("chromadb")');
  } catch {
    return null;
  }
}

async function checkChromaAvailability(): Promise<boolean> {
  if (isChromaAvailable !== null) return isChromaAvailable;

  try {
    const chroma = getChromaModule();
    if (!chroma) {
      isChromaAvailable = false;
      return false;
    }
    const client = new chroma.ChromaClient({ path: CHROMA_URL });
    await client.heartbeat();
    isChromaAvailable = true;
    console.log(`📡 Connected to ChromaDB vector store at ${CHROMA_URL}`);
  } catch {
    isChromaAvailable = false;
    console.log(
      `ℹ️ ChromaDB server not detected at ${CHROMA_URL}. Using file-backed local vector store (${LOCAL_STORE_FILE}).`
    );
  }

  return isChromaAvailable;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCollection(): Promise<any> {
  const available = await checkChromaAvailability();
  if (!available) return null;

  if (cachedCollection) return cachedCollection;

  const chroma = getChromaModule();
  if (!chroma) return null;

  const client = new chroma.ChromaClient({ path: CHROMA_URL });
  cachedCollection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: noopEmbeddingFunction,
    metadata: {
      description: "ASTra AST-aware code chunks and embeddings",
      embedding_dimension: 384,
    },
  });
  return cachedCollection;
}

// ---------------------------------------------------------------------------
// Storage Public API
// ---------------------------------------------------------------------------

/**
 * Delete all stored chunks for a specific repository.
 */
export async function clearRepoChunks(repoId: string): Promise<number> {
  const collection = await getCollection();

  if (collection) {
    // ChromaDB mode
    try {
      const existing = await collection.get({
        where: { repoId: { $eq: repoId } },
      });

      if (existing && existing.ids && existing.ids.length > 0) {
        await collection.delete({ ids: existing.ids });
        console.log(`🧹 Cleared ${existing.ids.length} existing chunk(s) from ChromaDB for "${repoId}"`);
        return existing.ids.length;
      }
    } catch (err) {
      console.warn(`Warning: Could not clear ChromaDB chunks for "${repoId}":`, err);
    }
    return 0;
  }

  // Local file fallback mode
  const localChunks = loadLocalStore();
  const filtered = localChunks.filter((c) => c.repoId !== repoId);
  const removed = localChunks.length - filtered.length;
  if (removed > 0) {
    saveLocalStore(filtered);
    console.log(`🧹 Cleared ${removed} existing chunk(s) from local file store for "${repoId}"`);
  }
  return removed;
}

/**
 * Store CodeChunk objects with embeddings and metadata.
 */
export async function storeChunks(chunks: CodeChunk[]): Promise<number> {
  if (chunks.length === 0) return 0;

  const collection = await getCollection();

  if (collection) {
    // ChromaDB mode
    const ids: string[] = [];
    const embeddings: number[][] = [];
    const documents: string[] = [];
    const metadatas: Record<string, string | number>[] = [];

    for (const chunk of chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) {
        throw new Error(`Chunk "${chunk.id}" missing required embedding vector`);
      }

      ids.push(chunk.id);
      embeddings.push(chunk.embedding);
      documents.push(chunk.content);
      metadatas.push({
        repoId: chunk.repoId,
        filePath: chunk.filePath,
        language: chunk.language,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbolName: chunk.symbolName || "",
        symbolType: chunk.symbolType || "module",
      });
    }

    console.log(`\n💾 Storing ${chunks.length} chunks in ChromaDB...`);
    const start = performance.now();

    const BATCH_SIZE = 100;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await collection.upsert({
        ids: ids.slice(i, i + BATCH_SIZE),
        embeddings: embeddings.slice(i, i + BATCH_SIZE),
        documents: documents.slice(i, i + BATCH_SIZE),
        metadatas: metadatas.slice(i, i + BATCH_SIZE),
      });
    }

    const elapsedMs = Math.round(performance.now() - start);
    console.log(`   Successfully stored ${chunks.length} chunks in ChromaDB (${elapsedMs}ms)`);
    return chunks.length;
  }

  // Local file fallback mode
  console.log(`\n💾 Storing ${chunks.length} chunks in local vector store...`);
  const start = performance.now();

  const store = loadLocalStore();
  // Remove any existing entries matching the incoming IDs
  const incomingIds = new Set(chunks.map((c) => c.id));
  const updatedStore = store.filter((c) => !incomingIds.has(c.id));

  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) {
      throw new Error(`Chunk "${chunk.id}" missing required embedding vector`);
    }
    updatedStore.push({
      id: chunk.id,
      repoId: chunk.repoId,
      filePath: chunk.filePath,
      language: chunk.language,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      symbolName: chunk.symbolName,
      symbolType: chunk.symbolType,
      embedding: chunk.embedding,
    });
  }

  saveLocalStore(updatedStore);
  const elapsedMs = Math.round(performance.now() - start);
  console.log(`   Successfully stored ${chunks.length} chunks in local file store (${elapsedMs}ms)`);
  return chunks.length;
}

/**
 * Query nearest-neighbor code chunks via vector similarity search.
 */
export async function querySimilarChunks(
  queryEmbedding: number[],
  topK = 10,
  repoId?: string
): Promise<CodeChunk[]> {
  const collection = await getCollection();

  if (collection) {
    // ChromaDB mode
    const queryOptions: {
      queryEmbeddings: number[][];
      nResults: number;
      where?: Record<string, { $eq: string }>;
      include: ["embeddings", "documents", "metadatas"];
    } = {
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      include: ["embeddings", "documents", "metadatas"],
    };

    if (repoId) {
      queryOptions.where = { repoId: { $eq: repoId } };
    }

    const response = await collection.query(queryOptions);
    const results: CodeChunk[] = [];

    if (response.ids && response.ids[0]) {
      const ids = response.ids[0];
      const docs = response.documents ? response.documents[0] : [];
      const metas = response.metadatas ? response.metadatas[0] : [];
      const vecs = response.embeddings ? response.embeddings[0] : [];

      for (let i = 0; i < ids.length; i++) {
        const meta = metas[i] as Record<string, string | number>;
        results.push({
          id: ids[i],
          repoId: String(meta.repoId || ""),
          filePath: String(meta.filePath || ""),
          language: String(meta.language || ""),
          content: String(docs[i] || ""),
          startLine: Number(meta.startLine || 1),
          endLine: Number(meta.endLine || 1),
          symbolName: meta.symbolName ? String(meta.symbolName) : undefined,
          symbolType: meta.symbolType
            ? (String(meta.symbolType) as CodeChunk["symbolType"])
            : "module",
          embedding: vecs[i] ? (vecs[i] as number[]) : undefined,
        });
      }
    }

    return results;
  }

  // Local file fallback mode with exact Cosine Similarity
  const store = loadLocalStore();
  const eligible = repoId ? store.filter((c) => c.repoId === repoId) : store;

  const scored = eligible.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

/**
 * Retrieve all stored chunks for a given repository (used for indexing & multi-hop).
 */
export async function getAllRepoChunks(repoId: string): Promise<CodeChunk[]> {
  const collection = await getCollection();
  if (collection) {
    try {
      const existing = await collection.get({
        where: { repoId: { $eq: repoId } },
        include: ["embeddings", "documents", "metadatas"],
      });

      const results: CodeChunk[] = [];
      if (existing && existing.ids) {
        const ids = existing.ids;
        const docs = existing.documents || [];
        const metas = existing.metadatas || [];
        const vecs = existing.embeddings || [];

        for (let i = 0; i < ids.length; i++) {
          const meta = metas[i] as Record<string, string | number>;
          results.push({
            id: ids[i],
            repoId: String(meta.repoId || ""),
            filePath: String(meta.filePath || ""),
            language: String(meta.language || ""),
            content: String(docs[i] || ""),
            startLine: Number(meta.startLine || 1),
            endLine: Number(meta.endLine || 1),
            symbolName: meta.symbolName ? String(meta.symbolName) : undefined,
            symbolType: meta.symbolType
              ? (String(meta.symbolType) as CodeChunk["symbolType"])
              : "module",
            embedding: vecs[i] ? (vecs[i] as number[]) : undefined,
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  const store = loadLocalStore();
  return store.filter((c) => c.repoId === repoId);
}

/**
 * Get statistical count of stored chunks for a given repository.
 */
export async function getRepoChunkCount(repoId: string): Promise<number> {
  const collection = await getCollection();
  if (collection) {
    try {
      const existing = await collection.get({
        where: { repoId: { $eq: repoId } },
      });
      return existing.ids ? existing.ids.length : 0;
    } catch {
      return 0;
    }
  }

  const store = loadLocalStore();
  return store.filter((c) => c.repoId === repoId).length;
}
