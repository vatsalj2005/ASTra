/**
 * verify-retrieval.ts — Verification Script for Phase 2 Hybrid Retrieval.
 *
 * Usage:
 *   npx tsx scripts/verify-retrieval.ts [repoUrl]
 *
 * Example:
 *   npx tsx scripts/verify-retrieval.ts https://github.com/expressjs/express-paginate
 *
 * Side-by-Side Comparative Verification:
 * 1. Semantic-Only Vector Search (Google Gemini text-embedding-004)
 * 2. BM25-Only Keyword Search (wink-bm25 code tokenizer)
 * 3. Hybrid RRF Search (Merged & Reranked + Confidence Signal)
 */

import { loadEnv } from "../src/lib/env";
loadEnv();

import { ingestRepository } from "../src/lib/ingestion";
import {
  searchSemantic,
  searchBM25,
  hybridRetrieve,
} from "../src/lib/retrieval";

// ANSI colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const DEFAULT_REPO = "https://github.com/expressjs/express-paginate";

const TEST_QUERIES = [
  {
    type: "Conceptual Query (Semantic strength)",
    query: "How to configure pagination defaults and middleware options?",
  },
  {
    type: "Exact Symbol Query (BM25 strength)",
    query: "paginate.hasPreviousPages",
  },
];

async function main() {
  const repoUrl = process.argv[2] || DEFAULT_REPO;

  console.log(`\n${BOLD}⚡ ASTra — Phase 2 Hybrid Retrieval Verification${RESET}`);
  console.log(`${DIM}   Target repository: ${repoUrl}${RESET}`);

  // 1. Ensure repository is ingested first
  console.log(`\n📦 Ensuring repository is ingested...`);
  const ingestResult = await ingestRepository(repoUrl);
  const repoId = ingestResult.repoId;

  // 2. Run retrieval comparative benchmarks for test queries
  for (const item of TEST_QUERIES) {
    console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${BOLD}${CYAN}Query Type: ${item.type}${RESET}`);
    console.log(`${BOLD}Query String: "${YELLOW}${item.query}${RESET}${BOLD}"${RESET}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Run Semantic Search Alone
    const semanticHits = await searchSemantic(item.query, repoId, 5);

    // Run BM25 Search Alone
    const bm25Hits = await searchBM25(item.query, repoId, 5);

    // Run Hybrid RRF Search
    const hybridResponse = await hybridRetrieve(item.query, repoId, { topN: 5 });

    // Print Semantic Results
    console.log(`\n  ${BOLD}[1] Semantic Vector Search (Google Gemini text-embedding-004):${RESET}`);
    if (semanticHits.length === 0) console.log(`      (No matches)`);
    semanticHits.forEach((hit, idx) => {
      console.log(
        `      ${idx + 1}. ${GREEN}${hit.chunk.filePath}:${hit.chunk.startLine}-${hit.chunk.endLine}${RESET} ` +
          `(${hit.chunk.symbolType}:${hit.chunk.symbolName || "module"})`
      );
    });

    // Print BM25 Results
    console.log(`\n  ${BOLD}[2] BM25 Keyword Search (Code Tokenizer):${RESET}`);
    if (bm25Hits.length === 0) console.log(`      (No matches)`);
    bm25Hits.forEach((hit, idx) => {
      console.log(
        `      ${idx + 1}. ${GREEN}${hit.chunk.filePath}:${hit.chunk.startLine}-${hit.chunk.endLine}${RESET} ` +
          `(${hit.chunk.symbolType}:${hit.chunk.symbolName || "module"}) ${DIM}[score=${hit.score.toFixed(2)}]${RESET}`
      );
    });

    // Print Hybrid RRF Results
    console.log(`\n  ${BOLD}[3] HYBRID RRF Merged Search (Final Reranked):${RESET}`);
    hybridResponse.results.forEach((hit, idx) => {
      const tag =
        hit.source === "hybrid"
          ? `${GREEN}HYBRID (Vector + BM25)${RESET}`
          : hit.source === "semantic"
          ? `${CYAN}Vector Only${RESET}`
          : `${YELLOW}BM25 Only${RESET}`;

      console.log(
        `      ${idx + 1}. ${GREEN}${hit.chunk.filePath}:${hit.chunk.startLine}-${hit.chunk.endLine}${RESET} ` +
          `(${hit.chunk.symbolType}:${hit.chunk.symbolName || "module"}) → ${tag} [RRF=${hit.score.toFixed(4)}]`
      );
    });

    // Print Confidence Signal
    console.log(`\n  ${BOLD}Confidence Assessment:${RESET}`);
    console.log(
      `      Status: ${
        hybridResponse.confidence.lowConfidence ? RED + "LOW CONFIDENCE" : GREEN + "HIGH CONFIDENCE"
      }${RESET}`
    );
    console.log(`      Score:  ${hybridResponse.confidence.score}`);
    console.log(`      Reason: ${hybridResponse.confidence.reason}`);
    console.log(`      Latency: ${hybridResponse.stats.latencyMs}ms`);
  }

  console.log(`\n${BOLD}${GREEN}🎉 Phase 2 Hybrid Retrieval Verification PASSED!${RESET}\n`);
}

main().catch((err) => {
  console.error(`\n${BOLD}${RED}❌ Phase 2 Verification FAILED:${RESET}`, err);
  process.exit(1);
});
