/**
 * Groq LLM Client Module for ASTra.
 *
 * Wraps groq-sdk with Llama 3.3 70B (llama-3.3-70b-versatile, free tier).
 * Features automatic model fallback (llama-3.1-8b-instant) & exponential backoff
 * for rate limits (HTTP 413 / 429) and API timeouts.
 */

import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import type { GenerationOptions } from "@/types";

// ---------------------------------------------------------------------------
// Configuration & Env Loader
// ---------------------------------------------------------------------------

import { loadEnv } from "@/lib/env";

loadEnv();

const PRIMARY_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

let groqClientInstance: Groq | null = null;

function getGroqClient(): Groq {
  if (groqClientInstance) return groqClientInstance;

  loadEnv();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    throw new Error(
      "GROQ_API_KEY environment variable is missing or placeholder. " +
        "Please add your Groq API key to .env.local (get a free key at https://console.groq.com)."
    );
  }

  groqClientInstance = new Groq({ apiKey });
  return groqClientInstance;
}

// ---------------------------------------------------------------------------
// Helper: Retry Delay
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main LLM Call API
// ---------------------------------------------------------------------------

export interface LLMResponse {
  text: string;
  model: string;
  latencyMs: number;
}

/**
 * Call Groq Llama 3.3 70B API with fallback to Llama 3.1 8B Instant on rate limits.
 *
 * @param messages - Chat messages array (system + user).
 * @param options - Generation options (temperature, maxTokens, model).
 */
export async function callGroqLLM(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: GenerationOptions
): Promise<LLMResponse> {
  const client = getGroqClient();
  let currentModel = options?.model || PRIMARY_MODEL;
  const temperature = options?.temperature ?? 0.1;
  const max_tokens = options?.maxTokens ?? 1024;

  const startTime = performance.now();
  let attempt = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await client.chat.completions.create({
        model: currentModel,
        messages,
        temperature,
        max_tokens,
      });

      const text = response.choices[0]?.message?.content || "";
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        text,
        model: currentModel,
        latencyMs,
      };
    } catch (err: unknown) {
      attempt++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        errorMessage.includes("429") ||
        errorMessage.includes("413") ||
        errorMessage.toLowerCase().includes("rate_limit_exceeded") ||
        errorMessage.toLowerCase().includes("tokens per minute");

      if (isRateLimit && currentModel !== FALLBACK_MODEL) {
        console.warn(
          `⚠️ Groq Rate Limit hit for ${currentModel}. Switching to fallback model: ${FALLBACK_MODEL}...`
        );
        currentModel = FALLBACK_MODEL;
      }

      if (attempt >= MAX_RETRIES) {
        if (isRateLimit) {
          throw new Error(
            `Groq Rate/Token Limit Exceeded: The codebase context required for this query is larger than your Groq API key's Tokens Per Minute (TPM) limit. Please wait a minute, use a smaller repository, or upgrade your Groq API key.`
          );
        }
        throw new Error(
          `Groq API call failed after ${MAX_RETRIES} attempts (${currentModel}): ${errorMessage}`
        );
      }

      console.warn(
        `Warning: Groq API call attempt ${attempt} failed (${isRateLimit ? "Rate limit/Size limit" : "Error"}). Retrying in ${delay}ms...`
      );
      await sleep(delay);
      delay *= 1.5;
    }
  }

  throw new Error(`Groq API invocation failed`);
}
