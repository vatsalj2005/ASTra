/**
 * verify-env.ts — Standalone environment verification script.
 *
 * Run with: npx tsx scripts/verify-env.ts
 *
 * Performs the same checks as the /api/health route, but outputs colored
 * console results and exits with code 0 (all pass) or 1 (any failure).
 * Useful for CI pipelines and quick local validation without starting
 * the Next.js dev server.
 */

import path from "path";
import { loadEnv } from "../src/lib/env";

loadEnv();

// ANSI color codes for terminal output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CHECK = `${GREEN}✓${RESET}`;
const CROSS = `${RED}✗${RESET}`;

function header(text: string) {
  console.log(`\n${BOLD}${CYAN}━━━ ${text} ━━━${RESET}`);
}

function pass(text: string, detail?: string) {
  console.log(`  ${CHECK} ${text}${detail ? ` ${DIM}${detail}${RESET}` : ""}`);
}

function fail(text: string, error?: string) {
  console.log(`  ${CROSS} ${text}`);
  if (error) console.log(`    ${RED}${error}${RESET}`);
}

async function main() {
  console.log(
    `\n${BOLD}🔍 Ask My Codebase — Environment Verification${RESET}`
  );
  console.log(`${DIM}   ${new Date().toISOString()}${RESET}`);

  let allPassed = true;

  // ── Check 1: Node.js ────────────────────────────────────────────────
  header("Runtime");
  pass("Node.js", process.version);

  // ── Check 2: Required environment variables ─────────────────────────
  header("Environment Variables");

  const envVars = [
    { name: "GROQ_API_KEY", required: false },
    { name: "EMBEDDING_MODEL", required: false },
    { name: "CHROMA_URL", required: false },
  ];

  for (const { name, required } of envVars) {
    const value = process.env[name];
    if (value && !value.startsWith("your_")) {
      pass(name, "(set)");
    } else if (required) {
      fail(name, "not set — required");
      allPassed = false;
    } else {
      console.log(
        `  ${YELLOW}○${RESET} ${name} ${DIM}(not set — optional, using default)${RESET}`
      );
    }
  }

  // ── Check 3: Embedding Model ────────────────────────────────────────
  header("Embedding Model (@xenova/transformers)");
  try {
    const { embedText, getModelName } = await import("../src/lib/embeddings");

    const start = performance.now();
    const vector = await embedText("hello world — verification test");
    const elapsed = Math.round(performance.now() - start);

    pass("Model loaded", getModelName());
    pass("Test embedding", `dim=${vector.length}, ${elapsed}ms`);

    // Sanity check: all-MiniLM-L6-v2 should produce 384-dimensional vectors
    if (vector.length !== 384) {
      console.log(
        `    ${YELLOW}⚠ Expected 384 dimensions, got ${vector.length}${RESET}`
      );
    }
  } catch (error) {
    fail(
      "Embedding model failed to load",
      error instanceof Error ? error.message : String(error)
    );
    allPassed = false;
  }

  // ── Check 4: Tree-sitter ────────────────────────────────────────────
  header("Tree-sitter (web-tree-sitter)");
  try {
    const { parseCode, getSupportedLanguages } = await import(
      "../src/lib/parser"
    );

    const languages = getSupportedLanguages();
    pass("Supported languages", languages.join(", "));

    // Test JavaScript parsing
    const jsCode = `function greet(name) {\n  return "Hello, " + name;\n}`;
    const tree = await parseCode(jsCode, "javascript");
    const rootType = tree.rootNode.type;
    const childCount = tree.rootNode.childCount;

    pass(
      "JavaScript parsing",
      `root=${rootType}, children=${childCount}`
    );

    // Test Python parsing
    const pyCode = `def greet(name):\n    return f"Hello, {name}"`;
    const pyTree = await parseCode(pyCode, "python");

    pass(
      "Python parsing",
      `root=${pyTree.rootNode.type}, children=${pyTree.rootNode.childCount}`
    );
  } catch (error) {
    fail(
      "Tree-sitter parsing failed",
      error instanceof Error ? error.message : String(error)
    );
    allPassed = false;
  }

  // ── Check 5: Key npm packages ───────────────────────────────────────
  header("Dependencies");
  const packages = [
    "next",
    "@xenova/transformers",
    "web-tree-sitter",
    "chromadb",
    "groq-sdk",
    "simple-git",
    "wink-bm25-text-search",
  ];

  for (const pkg of packages) {
    try {
      const pkgJsonPath = path.resolve(
        process.cwd(),
        "node_modules",
        pkg,
        "package.json"
      );
      const pkgJson = await import(pkgJsonPath, { with: { type: "json" } });
      pass(pkg, `v${pkgJson.default.version}`);
    } catch {
      // Some packages may have different resolution paths
      try {
        require.resolve(pkg);
        pass(pkg, "(installed)");
      } catch {
        fail(pkg, "not found in node_modules");
        allPassed = false;
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log(
    `\n${BOLD}${allPassed ? GREEN + "All checks passed! ✓" : RED + "Some checks failed ✗"}${RESET}\n`
  );

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
