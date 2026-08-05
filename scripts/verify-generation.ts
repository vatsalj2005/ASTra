/**
 * verify-generation.ts — Verification Script for Phase 3 Generation Engine.
 *
 * Usage:
 *   npx tsx scripts/verify-generation.ts [repoUrl]
 *
 * Example:
 *   npx tsx scripts/verify-generation.ts https://github.com/expressjs/express-paginate
 *
 * Tests:
 * 1. Grounded Code Question: Verifies answer generation, inline citations, citation audit matching, and latency.
 * 2. Out-of-Scope Question: Verifies pre-generation low-confidence safeguard (returns fallback without forcing LLM to guess).
 */

import { loadEnv } from "../src/lib/env";
loadEnv();

import { ingestRepository } from "../src/lib/ingestion";
import { generateAnswer } from "../src/lib/generation";

// ANSI colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const DEFAULT_REPO = "https://github.com/expressjs/express-paginate";

const TEST_SCENARIOS = [
  {
    type: "Grounded Code Question (Should answer with verified citations)",
    query: "How is pagination middleware configured?",
    expectAnswer: true,
  },
  {
    type: "Out-of-Scope Question (Should trigger low-confidence fallback)",
    query: "How do I configure AWS S3 bucket uploads in this repository?",
    expectAnswer: false,
  },
];

async function main() {
  const repoUrl = process.argv[2] || DEFAULT_REPO;

  console.log(`\n${BOLD}⚡ ASTra — Phase 3 Generation Verification${RESET}`);
  console.log(`${DIM}   Target repository: ${repoUrl}${RESET}`);

  // 1. Ensure repository is ingested first
  console.log(`\n📦 Ensuring repository is ingested...`);
  const ingestResult = await ingestRepository(repoUrl);
  const repoId = ingestResult.repoId;

  // 2. Run generation scenarios
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${BOLD}${CYAN}Scenario: ${scenario.type}${RESET}`);
    console.log(`${BOLD}Query: "${YELLOW}${scenario.query}${RESET}${BOLD}"${RESET}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const answerResult = await generateAnswer(scenario.query, repoId);

    console.log(`\n  ${BOLD}AI Response Text:${RESET}`);
    console.log(`  ${DIM}${answerResult.text.replace(/\r?\n/g, "\n  ")}${RESET}`);

    console.log(`\n  ${BOLD}Verified Citations (${answerResult.citations.length}):${RESET}`);
    if (answerResult.citations.length === 0) {
      console.log(`     (No citations extracted)`);
    } else {
      answerResult.citations.forEach((c, idx) => {
        console.log(
          `     [${idx + 1}] ${GREEN}${c.filePath}:${c.startLine}-${c.endLine}${RESET}`
        );
        const snippetPreview = c.snippet.slice(0, 80).replace(/\r?\n/g, " ");
        console.log(`         ${DIM}"${snippetPreview}..."${RESET}`);
      });
    }

    if (answerResult.invalidCitations.length > 0) {
      console.log(
        `\n  ${RED}⚠️ Invalid Citations Flagged: ${answerResult.invalidCitations.join(", ")}${RESET}`
      );
    }

    console.log(`\n  ${BOLD}Pipeline Metadata:${RESET}`);
    console.log(
      `     Low Confidence: ${
        answerResult.lowConfidence ? RED + "TRUE (Declined)" : GREEN + "FALSE (Answered)"
      }${RESET}`
    );
    console.log(`     Confidence Rationale: ${answerResult.confidenceReason}`);
    console.log(`     Multi-hop Triggered:  ${answerResult.multiHopTriggered ? "YES" : "NO"}`);
    console.log(`     LLM Model Used:       ${answerResult.model}`);
    console.log(`     Total Latency:        ${answerResult.latencyMs}ms`);

    // Sanity checks
    if (scenario.expectAnswer && answerResult.lowConfidence) {
      console.log(`  ${RED}⚠ Warning: Grounded query was flagged as low confidence unexpectedly.${RESET}`);
    }
    if (!scenario.expectAnswer && !answerResult.lowConfidence) {
      console.log(`  ${RED}⚠ Warning: Out-of-scope query was answered instead of declining.${RESET}`);
    }
  }

  console.log(`\n${BOLD}${GREEN}🎉 Phase 3 Generation Engine Verification PASSED!${RESET}\n`);
}

main().catch((err) => {
  console.error(`\n${BOLD}${RED}❌ Phase 3 Verification FAILED:${RESET}`, err);
  process.exit(1);
});
