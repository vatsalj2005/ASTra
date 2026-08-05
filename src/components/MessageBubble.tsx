"use client";

import React from "react";
import type { ChatMessage } from "@/context/RepoContext";
import { CitationLink } from "./CitationLink";
import { RetrievedChunksPanel } from "./RetrievedChunksPanel";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const answerData = message.answerData;
  const isRefusal = answerData?.lowConfidence;

  // Render text with clickable CitationLink components replacing [filePath:startLine-endLine]
  const renderFormattedContent = (text: string) => {
    const regex = /\[([a-zA-Z0-9_./\-]+):(\d+)(?:-(\d+))?\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;

      // Push text before match
      if (matchStart > lastIndex) {
        parts.push(text.slice(lastIndex, matchStart));
      }

      const filePath = match[1];
      const startLine = parseInt(match[2], 10);
      const endLine = match[3] ? parseInt(match[3], 10) : startLine;

      parts.push(
        <CitationLink
          key={`${filePath}-${startLine}-${endLine}-${matchStart}`}
          filePath={filePath}
          startLine={startLine}
          endLine={endLine}
        />
      );

      lastIndex = matchEnd;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} my-4 w-full`}>
      <div className="flex items-center gap-2 mb-1.5 px-1.5 text-[10px] text-text-muted font-mono tracking-wide uppercase">
        <span className="font-bold text-text-secondary">{isUser ? "You" : "ASTra AI"}</span>
        <span>•</span>
        <span>{message.timestamp}</span>
      </div>

      <div
        className={`max-w-3xl rounded-2xl p-5 sm:p-6 text-sm leading-relaxed shadow-xl backdrop-blur-xl transition-all duration-300 ${
          isUser
            ? "bg-gradient-to-br from-accent-primary to-accent-secondary text-white font-medium rounded-tr-none border-b border-white/10"
            : isRefusal
            ? "bg-bg-secondary/40 border border-error/20 text-text-primary rounded-tl-none"
            : "bg-bg-secondary/40 border border-card-border text-text-primary rounded-tl-none hover:border-white/10"
        }`}
      >
        {/* Low Confidence Warning Badge for Refusals */}
        {isRefusal && (
          <div className="mb-3.5 px-3 py-2 rounded-xl bg-error/10 border border-error/25 text-xs font-mono text-error flex items-start gap-2 shadow-inner">
            <span className="mt-0.5">🛡️</span>
            <span className="leading-relaxed">Context Insufficient — Grounding Safeguard Triggered</span>
          </div>
        )}

        {/* Formatted Content */}
        <div className="whitespace-pre-wrap font-sans text-text-primary font-normal leading-relaxed selection:bg-accent-primary/20">
          {renderFormattedContent(message.content)}
        </div>

        {/* Embedded Retrieved Chunks Panel for AI Messages */}
        {!isUser && answerData?.retrievedChunks && (
          <RetrievedChunksPanel chunks={answerData.retrievedChunks} />
        )}

        {/* Footer Metadata */}
        {!isUser && answerData && (
          <div className="mt-4 pt-3.5 border-t border-card-border flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-text-muted">
            <div className="flex items-center gap-3">
              <span>Model: <span className="text-text-secondary font-semibold">{answerData.model}</span></span>
              <span>•</span>
              <span>Latency: <span className="text-text-secondary font-semibold">{answerData.latencyMs}ms</span></span>
            </div>
            {answerData.multiHopTriggered && (
              <span className="text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded border border-accent-primary/20 flex items-center gap-1.5 animate-pulse">
                <span>🔁</span>
                <span>Multi-hop Pass</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
