/**
 * Prompt Builder Module for ASTra Generation Engine.
 *
 * Responsibilities:
 * 1. Construct system prompt enforcing strict context grounding & citation rules.
 * 2. Format retrieved CodeChunks with labeled source blocks for LLM reference.
 * 3. Enforce "I don't know" instructions when context is inadequate.
 */

import type { RetrievalResult } from "@/types";

/**
 * System prompt imposing strict anti-hallucination & citation grounding rules.
 */
export function buildSystemPrompt(): string {
  return `You are ASTra, an expert AI code explanation assistant. Your task is to answer natural-language questions about a software repository using ONLY the provided context chunks.

CRITICAL INSTRUCTIONS:
1. STRICT GROUNDING: Answer ONLY using the facts and code snippets provided in the CONTEXT CHUNKS. Do NOT rely on external knowledge or assumptions about unprovided files.
2. INLINE CITATIONS: For EVERY claim, explanation, or code reference, append an exact inline citation tag using the format:
   [filePath:startLine-endLine]  or  [filePath:startLine]
   Example: "The middleware validates default limit and maxLimit options [Readme.md:50-53]."
3. SOURCE REFERENCE: Refer to the exact file paths and line numbers provided in the [Source: ...] labels. Do NOT fabricate or alter line numbers.
4. INSUFFICIENT CONTEXT: If the provided chunks do not contain enough information to answer the question accurately, state:
   "I don't know based on the provided codebase context."`;
}

/**
 * Format retrieved CodeChunk candidates into a structured context block for the LLM.
 *
 * @param queryText - User's natural language question.
 * @param results - Ranked RetrievalResult candidates from Phase 2.
 */
export function formatUserPrompt(
  queryText: string,
  results: RetrievalResult[]
): string {
  const formattedBlocks = results.map((res, idx) => {
    const chunk = res.chunk;
    const symbolInfo = chunk.symbolName
      ? `, ${chunk.symbolType || "symbol"}: ${chunk.symbolName}`
      : "";

    return `--- CONTEXT CHUNK #${idx + 1} ---
[Source: ${chunk.filePath}${symbolInfo}, lines ${chunk.startLine}-${chunk.endLine}]
\`\`\`${chunk.language || ""}
${chunk.content}
\`\`\``;
  });

  return `USER QUESTION:
${queryText}

CONTEXT CHUNKS (${results.length} relevant snippet(s) from repository):
${formattedBlocks.join("\n\n")}

Remember: Cite exact [filePath:startLine-endLine] tags for all statements. If context is insufficient, reply "I don't know based on the provided codebase context."`;
}
