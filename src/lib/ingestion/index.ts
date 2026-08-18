/**
 * Ingestion Pipeline Orchestrator for ASTra.
 *
 * Combines all Phase 1 sub-modules into a single pipeline:
 * 1. Fetch Repository (shallow clone via simple-git + size check)
 * 2. Filter Files (configurable ignore/allow lists & size caps)
 * 3. Chunk Files (AST parsing for code, header sections for docs)
 * 4. Enrich Context & Batch Embed (Google Gemini text-embedding-004 model)
 * 5. Vector Store (ChromaDB upsert & metadata indexing)
 * 6. Cleanup temporary repo files
 */

import { fetchRepository, cleanupRepository } from "./fetcher";
import { getFilteredFileList } from "./filter";
import { chunkAllFiles } from "./chunker";
import { embedChunks } from "@/lib/embeddings";
import { clearRepoChunks, storeChunks } from "@/lib/vector-store";
import type { FilterConfig, IngestionResult } from "@/types";

export * from "./fetcher";
export * from "./filter";
export * from "./chunker";

/**
 * Execute the end-to-end repository ingestion pipeline.
 *
 * @param repoUrl - Public GitHub repository URL or "owner/repo" shorthand.
 * @param customFilterConfig - Optional custom filter rules.
 * @returns IngestionResult with execution metrics and chunk summary.
 */
export async function ingestRepository(
  repoUrl: string,
  customFilterConfig?: FilterConfig
): Promise<IngestionResult> {
  const startTime = performance.now();
  console.log(`\n🚀 Starting Ingestion Pipeline for: ${repoUrl}`);

  let repoDir = "";
  let repoId = "";

  try {
    // 1. Fetch repository
    const fetchResult = await fetchRepository(repoUrl);
    repoDir = fetchResult.repoDir;
    repoId = fetchResult.repoId;

    // 2. Filter files
    console.log(`\n🔍 Filtering repository files...`);
    const fileList = await getFilteredFileList(repoDir, customFilterConfig);
    console.log(`   Found ${fileList.length} files passing filter rules.`);

    if (fileList.length === 0) {
      throw new Error(`No eligible source or doc files found in repository "${repoId}".`);
    }



    // 3. Clear previous chunks for clean re-ingestion
    await clearRepoChunks(repoId);

    // 4. Extract AST & Doc Chunks
    const chunks = await chunkAllFiles(repoId, repoDir, fileList);

    if (chunks.length === 0) {
      throw new Error(`No valid code or document chunks extracted from repository.`);
    }

    // 5. Context-Enrich & Embed Chunks
    const embeddedChunks = await embedChunks(chunks);

    // 6. Store in Vector Database (ChromaDB)
    await storeChunks(embeddedChunks);

    // 7. Cleanup temp files
    cleanupRepository(repoDir);

    const elapsedMs = Math.round(performance.now() - startTime);

    // Compute language list and chunk summary
    const languages = Array.from(
      new Set(chunks.map((c) => c.language).filter(Boolean))
    );

    const chunkSummary = {
      functions: chunks.filter((c) => c.symbolType === "function").length,
      classes: chunks.filter((c) => c.symbolType === "class").length,
      methods: chunks.filter((c) => c.symbolType === "method").length,
      modules: chunks.filter((c) => c.symbolType === "module").length,
      docs: chunks.filter((c) => c.symbolType === "doc").length,
    };

    console.log(`\n✅ Ingestion Pipeline Complete for "${repoId}"!`);
    console.log(`   Processed ${fileList.length} files → ${chunks.length} chunks in ${(elapsedMs / 1000).toFixed(2)}s`);
    console.log(`   Summary: ${chunkSummary.functions} functions, ${chunkSummary.classes} classes, ${chunkSummary.methods} methods, ${chunkSummary.docs} docs, ${chunkSummary.modules} modules.`);

    return {
      repoId,
      fileCount: fileList.length,
      chunkCount: chunks.length,
      languages,
      timeTakenMs: elapsedMs,
      chunkSummary,
    };
  } catch (error) {
    if (repoDir) {
      cleanupRepository(repoDir);
    }
    console.error(`\n❌ Ingestion Pipeline Failed:`, error);
    throw error;
  }
}
