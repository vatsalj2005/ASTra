/**
 * Prompt Builder Module for ASTra Generation Engine.
 *
 * Responsibilities:
 * 1. Construct system prompt enforcing strict context grounding & citation rules.
 * 2. Format repository file inventory & retrieved CodeChunks with smart truncation.
 * 3. Enforce "I don't know" instructions when context is inadequate.
 */

import type { RetrievalResult } from "@/types";

const MAX_CHUNK_CHARS = 1500;
const MAX_TOTAL_CONTEXT_CHARS = 12000;

/**
 * System prompt imposing strict anti-hallucination & citation grounding rules.
 */
export function buildSystemPrompt(): string {
  return `You are ASTra, an expert AI code explanation assistant. Your task is to answer natural-language questions about a software repository using ONLY the provided file inventory and context chunks.

CRITICAL INSTRUCTIONS:
1. STRICT GROUNDING: Answer ONLY using the facts, file inventory, and code snippets provided in the CONTEXT. Do NOT rely on external assumptions.
2. FILE INVENTORY & STATS: Use the REPOSITORY FILE INVENTORY section to accurately answer file listings, file counts (e.g., .txt, .ts, .md files), or directory structure questions.
3. INLINE CITATIONS: For EVERY claim, code explanation, or file reference, append an exact inline citation tag in the format:
   [filePath:startLine-endLine]  or  [filePath:startLine]
   Example: "The middleware validates default limit and maxLimit options [Readme.md:50-53]."
4. SOURCE REFERENCE: Refer to the exact file paths and line numbers provided. Do NOT fabricate line numbers.
5. INSUFFICIENT CONTEXT: If the provided context does not contain enough information to answer the question accurately, state:
   "I don't know based on the provided codebase context."`;
}

/**
 * Format repository file inventory and retrieved CodeChunk candidates into a structured context block.
 *
 * @param queryText - User's natural language question.
 * @param results - Ranked RetrievalResult candidates from Phase 2.
 * @param repoId - Target repository identifier.
 * @param allFilePaths - Array of unique file paths present in the ingested repository.
 */
export function formatUserPrompt(
  queryText: string,
  results: RetrievalResult[],
  repoId?: string,
  allFilePaths?: string[]
): string {
  let fileInventoryBlock = "";
  if (allFilePaths && allFilePaths.length > 0) {
    const MAX_INVENTORY_FILES = 100;
    let fileListStr = "";
    if (allFilePaths.length > MAX_INVENTORY_FILES) {
      fileListStr = allFilePaths.slice(0, MAX_INVENTORY_FILES).map((f) => `- ${f}`).join("\n") +
        `\n... [truncated ${allFilePaths.length - MAX_INVENTORY_FILES} files]`;
    } else {
      fileListStr = allFilePaths.map((f) => `- ${f}`).join("\n");
    }

    fileInventoryBlock = `--- REPOSITORY FILE INVENTORY (${repoId || "repo"}) ---
Total Ingested Files (${allFilePaths.length} files):
${fileListStr}

`;
  }

  let cumulativeChars = 0;
  const formattedBlocks: string[] = [];

  for (let idx = 0; idx < results.length; idx++) {
    const res = results[idx];
    const chunk = res.chunk;
    const symbolInfo = chunk.symbolName
      ? `, ${chunk.symbolType || "symbol"}: ${chunk.symbolName}`
      : "";

    let content = chunk.content;
    if (content.length > MAX_CHUNK_CHARS) {
      content =
        content.slice(0, MAX_CHUNK_CHARS) +
        `\n... [truncated ${content.length - MAX_CHUNK_CHARS} characters]`;
    }

    const block = `--- CONTEXT CHUNK #${idx + 1} ---
[Source: ${chunk.filePath}${symbolInfo}, lines ${chunk.startLine}-${chunk.endLine}]
\`\`\`${chunk.language || ""}
${content}
\`\`\``;

    if (cumulativeChars + block.length > MAX_TOTAL_CONTEXT_CHARS) {
      break; // Stop adding chunks if total context limit is reached
    }

    formattedBlocks.push(block);
    cumulativeChars += block.length;
  }

  return `USER QUESTION:
${queryText}

${fileInventoryBlock}CONTEXT CHUNKS (${formattedBlocks.length} relevant snippet(s) from repository):
${formattedBlocks.join("\n\n")}

Remember: Cite exact [filePath:startLine-endLine] tags for all statements. Use the file inventory for file count & directory questions. If context is insufficient, reply "I don't know based on the provided codebase context."`;
}
