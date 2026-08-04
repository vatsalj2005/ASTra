/**
 * Generation Pipeline Orchestrator for ASTra.
 *
 * Responsibilities:
 * 1. Executes Phase 2 Hybrid Retrieval & checks Pre-generation Confidence Signal.
 * 2. If confidence is low, gracefully returns early without invoking LLM (prevents guessing & rate limits).
 * 3. Constructs strictly grounded System & User Prompts with labeled source blocks.
 * 4. Calls Groq API (Llama 3.3 70B, free tier) with retry logic.
 * 5. Parses and audits inline citations against real retrieved CodeChunk metadata.
 * 6. Triggers 1-hop reference retrieval pass if LLM answer mentions unretrieved symbols.
 * 7. Returns complete, validated GeneratedAnswer object.
 */

import { hybridRetrieve, retrieveByReference } from "@/lib/retrieval";
import { buildSystemPrompt, formatUserPrompt } from "./prompt-builder";
import { callGroqLLM } from "./groq-client";
import { parseAndValidateCitations } from "./citation-parser";
import { detectUnretrievedReferences } from "./multi-hop-detector";
import type { GeneratedAnswer, GenerationOptions, RetrievalResult } from "@/types";

export * from "./prompt-builder";
export * from "./groq-client";
export * from "./citation-parser";
export * from "./multi-hop-detector";

/**
 * Generate a grounded, cited natural-language answer for a query against an ingested repo.
 *
 * @param queryText - Raw user question.
 * @param repoId - Target repository identifier (e.g., "owner/repo").
 * @param options - Optional generation configuration (model, maxTokens, temperature).
 */
export async function generateAnswer(
  queryText: string,
  repoId: string,
  options?: GenerationOptions
): Promise<GeneratedAnswer> {
  const startTime = performance.now();
  console.log(`\n🤖 Starting Generation Engine for query: "${queryText}"`);

  // 1. Run Phase 2 Hybrid Retrieval
  const retrievalResponse = await hybridRetrieve(queryText, repoId);
  const { results: retrievedResults, confidence } = retrievalResponse;

  // 2. Pre-Generation Confidence Safeguard
  if (confidence.lowConfidence) {
    console.log(`\n🛡️ Pre-generation confidence check flagged LOW CONFIDENCE.`);
    console.log(`   Reason: ${confidence.reason}`);
    console.log(`   Skipping LLM call to prevent hallucination.`);

    const elapsedMs = Math.round(performance.now() - startTime);
    return {
      text: "I couldn't find enough relevant information in this codebase to answer that confidently.",
      citations: [],
      invalidCitations: [],
      retrievedChunks: retrievedResults,
      lowConfidence: true,
      confidenceReason: confidence.reason,
      multiHopTriggered: false,
      model: options?.model || "llama-3.3-70b-versatile",
      latencyMs: elapsedMs,
    };
  }

  // 3. Build Grounded Prompts
  const systemPrompt = buildSystemPrompt();
  let userPrompt = formatUserPrompt(queryText, retrievedResults);
  let activeResults = [...retrievedResults];
  let multiHopTriggered = false;

  // 4. Initial LLM Generation Call
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  let llmResponse = await callGroqLLM(messages, options);

  // 5. Check for 1-Hop Multi-Hop Trigger (if allowed)
  if (options?.allowMultiHop !== false) {
    const unretrievedSymbols = detectUnretrievedReferences(
      llmResponse.text,
      activeResults.map((r) => r.chunk)
    );

    if (unretrievedSymbols.length > 0) {
      const targetSymbol = unretrievedSymbols[0];
      console.log(`\n🔁 Multi-hop trigger: Answer referenced unretrieved symbol "${targetSymbol}"`);

      const extraHits = await retrieveByReference(targetSymbol, repoId, 3);
      if (extraHits.length > 0) {
        console.log(`   Found ${extraHits.length} additional chunk(s) via 1-hop reference lookup.`);
        multiHopTriggered = true;

        // Deduplicate and append extra chunks
        const existingIds = new Set(activeResults.map((r) => r.chunk.id));
        for (const hit of extraHits) {
          if (!existingIds.has(hit.chunk.id)) {
            activeResults.push(hit);
          }
        }

        // Re-build user prompt with expanded context and re-run generation once
        userPrompt = formatUserPrompt(queryText, activeResults);
        const updatedMessages = [
          { role: "system" as const, content: systemPrompt },
          { role: "user" as const, content: userPrompt },
        ];

        llmResponse = await callGroqLLM(updatedMessages, options);
      }
    }
  }

  // 6. Parse and Validate Citations
  const { citations, invalidCitations } = parseAndValidateCitations(
    llmResponse.text,
    activeResults.map((r) => r.chunk)
  );

  // 7. Post-Generation "I don't know" Check
  const isDeclined = llmResponse.text
    .toLowerCase()
    .includes("i don't know based on the provided codebase context");

  const elapsedTotalMs = Math.round(performance.now() - startTime);

  console.log(`\n✅ Generation Complete (${llmResponse.model}, ${elapsedTotalMs}ms)`);
  console.log(`   Verified Citations: ${citations.length} valid, ${invalidCitations.length} invalid.`);

  return {
    text: llmResponse.text,
    citations,
    invalidCitations,
    retrievedChunks: activeResults,
    lowConfidence: isDeclined,
    confidenceReason: isDeclined ? "LLM indicated context was insufficient" : confidence.reason,
    multiHopTriggered,
    model: llmResponse.model,
    latencyMs: elapsedTotalMs,
  };
}
