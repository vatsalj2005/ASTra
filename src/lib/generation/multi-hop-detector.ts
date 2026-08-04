/**
 * Multi-Hop Reference Detector for ASTra.
 *
 * Scans LLM answer text for mentions of functions, classes, or methods
 * that were referenced in the text but NOT included in the initial retrieved chunk set.
 *
 * Used by the generation orchestrator to trigger a 1-hop reference lookup.
 */

import type { CodeChunk } from "@/types";

// Regex matching identifier references: functionCalls(), ClassNames, or module.method()
const SYMBOL_PATTERN = /\b([a-zA-Z_$][a-zA-Z0-9_$]{3,})\s*(?:\(\)|:)/g;

/**
 * Scan answer text for unretrieved symbol references.
 *
 * @param answerText - Raw generated answer text from LLM.
 * @param retrievedChunks - Initial chunks passed to LLM context.
 * @returns Array of symbol names referenced in text but missing from retrieved chunks.
 */
export function detectUnretrievedReferences(
  answerText: string,
  retrievedChunks: CodeChunk[]
): string[] {
  if (!answerText) return [];

  // Build set of all symbol names & keywords present in current chunks
  const knownSymbols = new Set<string>();
  for (const chunk of retrievedChunks) {
    if (chunk.symbolName) {
      knownSymbols.add(chunk.symbolName.toLowerCase());
    }
    // Also add words in file path
    chunk.filePath.split(/[^a-zA-Z0-9_$]+/).forEach((w) => {
      if (w.length > 2) knownSymbols.add(w.toLowerCase());
    });
  }

  const unretrieved = new Set<string>();
  SYMBOL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SYMBOL_PATTERN.exec(answerText)) !== null) {
    const symbol = match[1];
    const lowerSymbol = symbol.toLowerCase();

    // Skip common programming keywords
    if (
      [
        "function",
        "return",
        "class",
        "import",
        "export",
        "const",
        "async",
        "await",
        "string",
        "number",
        "boolean",
        "object",
        "array",
        "promise",
        "undefined",
        "null",
      ].includes(lowerSymbol)
    ) {
      continue;
    }

    if (!knownSymbols.has(lowerSymbol)) {
      unretrieved.add(symbol);
    }
  }

  return Array.from(unretrieved);
}
