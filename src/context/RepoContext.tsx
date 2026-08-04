"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { GeneratedAnswer, IngestionResult } from "@/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  answerData?: GeneratedAnswer;
}

export type AppStage = "input" | "ingesting" | "chat";

interface RepoContextType {
  stage: AppStage;
  repoUrl: string;
  repoId: string;
  ingestionResult: IngestionResult | null;
  messages: ChatMessage[];
  isLoadingAnswer: boolean;
  ingestionProgressStep: string;
  error: string | null;
  startIngestion: (url: string) => Promise<void>;
  sendQuestion: (question: string) => Promise<void>;
  resetRepo: () => void;
  clearError: () => void;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export function RepoProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<AppStage>("input");
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [repoId, setRepoId] = useState<string>("");
  const [ingestionResult, setIngestionResult] = useState<IngestionResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState<boolean>(false);
  const [ingestionProgressStep, setIngestionProgressStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const startIngestion = async (url: string) => {
    setError(null);
    setRepoUrl(url);
    setStage("ingesting");
    setIngestionProgressStep("Connecting to GitHub & cloning repository...");

    try {
      // Step 1: Simulate progress updates
      const stepTimer1 = setTimeout(() => setIngestionProgressStep("Filtering source files & documentation..."), 800);
      const stepTimer2 = setTimeout(() => setIngestionProgressStep("Parsing syntax trees (web-tree-sitter)..."), 1600);
      const stepTimer3 = setTimeout(() => setIngestionProgressStep("Generating local embeddings (all-MiniLM-L6-v2)..."), 2400);

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Ingestion failed.");
      }

      const result: IngestionResult = data.result;
      setIngestionResult(result);
      setRepoId(result.repoId);
      setStage("chat");
      setMessages([
        {
          id: "welcome-" + Date.now(),
          role: "assistant",
          content: `Ingestion complete! I have ingested **${result.repoId}** (${result.fileCount} files, ${result.chunkCount} code & doc chunks). Ask me anything about how this codebase works!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStage("input");
    }
  };

  const sendQuestion = async (question: string) => {
    if (!question.trim() || isLoadingAnswer) return;

    setError(null);
    const userMsgId = "user-" + Date.now();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: question.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoadingAnswer(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, question: question.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate answer.");
      }

      const answer: GeneratedAnswer = data.answer;
      const aiMsg: ChatMessage = {
        id: "ai-" + Date.now(),
        role: "assistant",
        content: answer.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        answerData: answer,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  const resetRepo = () => {
    setStage("input");
    setRepoUrl("");
    setRepoId("");
    setIngestionResult(null);
    setMessages([]);
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <RepoContext.Provider
      value={{
        stage,
        repoUrl,
        repoId,
        ingestionResult,
        messages,
        isLoadingAnswer,
        ingestionProgressStep,
        error,
        startIngestion,
        sendQuestion,
        resetRepo,
        clearError,
      }}
    >
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  const context = useContext(RepoContext);
  if (!context) {
    throw new Error("useRepo must be used within a RepoProvider");
  }
  return context;
}
