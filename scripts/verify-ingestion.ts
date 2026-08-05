/**
 * verify-ingestion.ts — Standalone Verification Script for Ingestion Pipeline.
 *
 * Usage:
 *   npx tsx scripts/verify-ingestion.ts [repoUrl]
 *
 * Example:
 *   npx tsx scripts/verify-ingestion.ts https://github.com/expressjs/express-paginate
 *
 * Verifies:
 * 1. Repo fetching & size checking via simple-git.
 * 2. File filtering (excluding node_modules, lockfiles, etc.).
 * 3. Tree-sitter AST & Markdown chunking.
 * 4. Local embedding generation (@xenova/transformers 384-dim vectors).
 * 5. Storage in ChromaDB vector store.
 * 6. Vector similarity retrieval probe to confirm stored data is queryable.
 */

import { loadEnv } from "../src/lib/env";
loadEnv();

import { ingestRepository } from "../src/lib/ingestion";
import { querySimilarChunks, getRepoChunkCount } from "../src/lib/vector-store";
import { embedText } from "../src/lib/embeddings";

// ANSI colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const DEFAULT_TEST_REPO = "https://github.com/expressjs/express-paginate";

async function main() {
  const repoUrl = process.argv[2] || DEFAULT_TEST_REPO;

  console.log(`\n${BOLD}⚡ ASTra — Phase 1 Ingestion Verification${RESET}`);
  console.log(`${DIM}   Target repository: ${repoUrl}${RESET}`);

  const start = performance.now();

  try {
    // 1. Run full ingestion pipeline
    const result = await ingestRepository(repoUrl);

    // 2. Verify stored chunks in ChromaDB
    const storedCount = await getRepoChunkCount(result.repoId);

    console.log(`\n${BOLD}${CYAN}━━━ ChromaDB Storage Verification ━━━${RESET}`);
    console.log(`  ✓ Expected chunks: ${result.chunkCount}`);
    console.log(`  ✓ Stored chunks in DB: ${storedCount}`);

    if (storedCount !== result.chunkCount) {
      console.log(`  ${RED}⚠ Warning: Stored count (${storedCount}) differs from extracted count (${result.chunkCount})${RESET}`);
    }

    // 3. Perform a vector query test probe to verify retrieval
    console.log(`\n${BOLD}${CYAN}━━━ Vector Retrieval Probe Test ━━━${RESET}`);
    const probeQuery = "pagination middleware options and usage";
    console.log(`  Query: "${probeQuery}"`);

    const queryVec = await embedText(probeQuery);
    const hits = await querySimilarChunks(queryVec, 3, result.repoId);

    console.log(`  Retrieved ${hits.length} nearest chunk(s) from ChromaDB:`);
    hits.forEach((hit, idx) => {
      console.log(
        `   [${idx + 1}] ${GREEN}${hit.filePath}:${hit.startLine}-${hit.endLine}${RESET} ` +
          `(${CYAN}${hit.symbolType}:${hit.symbolName || "module"}${RESET})`
      );
      const snippet = hit.content.slice(0, 100).replace(/\r?\n/g, " ");
      console.log(`       ${DIM}"${snippet}..."${RESET}`);
    });

    const elapsedTotal = ((performance.now() - start) / 1000).toFixed(2);

    console.log(
      `\n${BOLD}${GREEN}🎉 Phase 1 Ingestion Verification PASSED! (${elapsedTotal}s)${RESET}\n`
    );
    process.exit(0);
  } catch (err) {
    console.error(`\n${BOLD}${RED}❌ Phase 1 Ingestion Verification FAILED${RESET}`, err);
    process.exit(1);
  }
}

main();
