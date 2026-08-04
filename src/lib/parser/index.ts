/**
 * Tree-sitter parsing wrapper for Ask My Codebase.
 *
 * Uses web-tree-sitter (WASM-based) to parse source code into ASTs.
 * This is the foundation of our "AST-aware chunking" strategy — instead
 * of splitting code by character count (which breaks mid-expression and
 * produces incoherent chunks), we parse the AST and extract complete
 * functions, classes, and methods as individual chunks.
 *
 * Design decisions:
 * - Why web-tree-sitter over native tree-sitter? Native bindings require
 *   node-gyp and C++ compilation, which is fragile on Windows and in CI.
 *   WASM binaries are portable and just work.
 * - Why prebuilt WASM grammars? We build them during `npm run setup` from
 *   the official tree-sitter grammar packages to guarantee version
 *   compatibility with our web-tree-sitter runtime.
 * - Grammars are loaded lazily and cached — first parse for a language
 *   takes ~50ms (WASM load), subsequent parses are <5ms.
 */

import { Parser, Language, type Tree } from "web-tree-sitter";
import path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Map file extensions to tree-sitter language names.
 * Add entries here to support new languages.
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
};

/**
 * Map language names to WASM grammar file names.
 */
const LANGUAGE_TO_WASM: Record<string, string> = {
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  python: "tree-sitter-python.wasm",
};

// ---------------------------------------------------------------------------
// Singleton State
// ---------------------------------------------------------------------------

let parserInitialized = false;
let initPromise: Promise<void> | null = null;
const loadedLanguages: Map<string, Language> = new Map();

/**
 * Resolve the path to the grammars/ directory.
 * In production, this sits at the project root.
 */
function getGrammarsDir(): string {
  // Navigate from src/lib/parser/ to project root
  return path.resolve(process.cwd(), "grammars");
}

/**
 * Initialize the web-tree-sitter runtime. Must be called before any parsing.
 * Safe to call multiple times — initialization is idempotent.
 */
async function ensureInitialized(): Promise<void> {
  if (parserInitialized) return;

  if (!initPromise) {
    initPromise = Parser.init().then(() => {
      parserInitialized = true;
    });
  }

  await initPromise;
}

/**
 * Load a language grammar (WASM file) and cache it.
 */
async function loadLanguage(language: string): Promise<Language> {
  const cached = loadedLanguages.get(language);
  if (cached) return cached;

  const wasmFile = LANGUAGE_TO_WASM[language];
  if (!wasmFile) {
    throw new Error(
      `Unsupported language: "${language}". ` +
        `Supported: ${Object.keys(LANGUAGE_TO_WASM).join(", ")}`
    );
  }

  const wasmPath = path.join(getGrammarsDir(), wasmFile);
  const lang = await Language.load(wasmPath);
  loadedLanguages.set(language, lang);
  return lang;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse source code into a tree-sitter syntax tree.
 *
 * @param code - The source code string to parse.
 * @param language - The language name (e.g., "javascript", "python").
 * @returns The parsed syntax tree.
 *
 * @example
 * ```ts
 * const tree = await parseCode("function hello() { return 42; }", "javascript");
 * console.log(tree.rootNode.toString());
 * // => (program (function_declaration ...))
 * ```
 */
export async function parseCode(
  code: string,
  language: string
): Promise<Tree> {
  await ensureInitialized();

  const lang = await loadLanguage(language);
  const parser = new Parser();
  parser.setLanguage(lang);

  const tree = parser.parse(code);
  if (!tree) {
    throw new Error(`Failed to parse code for language: ${language}`);
  }
  return tree;
}

/**
 * Detect the programming language from a file extension.
 *
 * @param filePath - File path or name with extension.
 * @returns The language name, or null if unsupported.
 */
export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || null;
}

/**
 * Get the list of currently supported languages.
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_TO_WASM);
}

/**
 * Check if a given file extension is supported for parsing.
 */
export function isSupportedFile(filePath: string): boolean {
  return detectLanguage(filePath) !== null;
}
