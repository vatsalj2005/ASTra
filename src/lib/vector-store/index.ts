/**
 * Vector store abstraction — ChromaDB (local dev) / Supabase pgvector (production).
 *
 * This module will provide a unified interface for storing and querying
 * code chunk embeddings, abstracting over the underlying storage backend:
 *
 * - LOCAL DEV: ChromaDB (embedded, no account needed, instant setup).
 * - PRODUCTION: Supabase pgvector (free tier, hosted, persistent).
 *
 * The abstraction allows swapping backends via environment variables
 * without changing any calling code in the ingestion or retrieval modules.
 *
 * Key operations:
 * - upsertChunks(chunks: CodeChunk[]): Store/update chunks with embeddings.
 * - similaritySearch(vector: number[], topK: number): Nearest-neighbor query.
 * - deleteRepo(repoId: string): Remove all chunks for a given repository.
 * - getStats(): Return collection size, dimensions, etc.
 *
 * Not implemented yet — this is a Phase 1/2 concern.
 *
 * @module vector-store
 */

export {};
