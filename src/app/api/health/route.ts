import { NextResponse } from "next/server";
import type { HealthCheckResponse } from "@/types";

/**
 * GET /api/health
 *
 * Health-check endpoint that verifies all core subsystems are operational:
 * 1. Next.js is serving (implicit — if this runs, it works)
 * 2. Embedding model loads and can embed a test string
 * 3. Tree-sitter can parse a JavaScript code snippet
 *
 * Each check is isolated in a try/catch so a failure in one doesn't
 * prevent the others from being tested. The response reports individual
 * status for each subsystem, making it easy to diagnose partial failures.
 *
 * Usage:
 *   curl http://localhost:3000/api/health
 *   → { status: "healthy", checks: { nextjs: true, embedding: {...}, treeSitter: {...} } }
 */
export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const response: HealthCheckResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      nextjs: true, // If we reach here, Next.js is working.
      embedding: { ok: false },
      treeSitter: { ok: false },
    },
  };

  // ── Check 1: Embedding Model ──────────────────────────────────────────
  try {
    const { embedText, getModelName } = await import("@/lib/embeddings");

    const start = performance.now();
    const vector = await embedText("hello world — health check test string");
    const elapsed = Math.round(performance.now() - start);

    response.checks.embedding = {
      ok: true,
      model: getModelName(),
      dimension: vector.length,
      latencyMs: elapsed,
    };
  } catch (error) {
    response.checks.embedding = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // ── Check 2: Tree-sitter Parser ───────────────────────────────────────
  try {
    const { parseCode, getSupportedLanguages } = await import("@/lib/parser");

    const testCode = `
function greet(name) {
  console.log("Hello, " + name);
  return true;
}
`.trim();

    const tree = await parseCode(testCode, "javascript");
    const nodeCount = countNodes(tree.rootNode);

    response.checks.treeSitter = {
      ok: true,
      languages: getSupportedLanguages(),
      testNodeCount: nodeCount,
    };
  } catch (error) {
    response.checks.treeSitter = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // ── Determine overall status ──────────────────────────────────────────
  const allOk =
    response.checks.nextjs &&
    response.checks.embedding.ok &&
    response.checks.treeSitter.ok;

  const anyOk =
    response.checks.nextjs ||
    response.checks.embedding.ok ||
    response.checks.treeSitter.ok;

  response.status = allOk ? "healthy" : anyOk ? "degraded" : "unhealthy";

  return NextResponse.json(response, {
    status: allOk ? 200 : 503,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively count all nodes in a tree-sitter syntax tree.
 * Used to verify the parser produced a non-trivial result.
 */
function countNodes(node: { childCount: number; child(i: number): typeof node | null }): number {
  let count = 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) count += countNodes(child);
  }
  return count;
}
