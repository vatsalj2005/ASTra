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
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} my-4`}>
      <div className="flex items-center gap-2 mb-1 px-1 text-xs text-slate-400 font-mono">
        <span className="font-semibold">{isUser ? "You" : "ASTra AI"}</span>
        <span>•</span>
        <span>{message.timestamp}</span>
      </div>

      <div
        className={`max-w-3xl rounded-2xl p-4 sm:p-5 text-sm leading-relaxed shadow-lg backdrop-blur-md ${
          isUser
            ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-medium rounded-tr-none"
            : isRefusal
            ? "bg-slate-900/90 border border-amber-500/30 text-slate-200 rounded-tl-none"
            : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none"
        }`}
      >
        {/* Low Confidence Warning Badge for Refusals */}
        {isRefusal && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-400 flex items-center gap-2">
            <span>🛡️</span>
            <span>Context Insufficient — Grounding Safeguard Triggered</span>
          </div>
        )}

        {/* Formatted Content */}
        <div className="whitespace-pre-wrap font-sans text-slate-200">
          {renderFormattedContent(message.content)}
        </div>

        {/* Embedded Retrieved Chunks Panel for AI Messages */}
        {!isUser && answerData?.retrievedChunks && (
          <RetrievedChunksPanel chunks={answerData.retrievedChunks} />
        )}

        {/* Footer Metadata */}
        {!isUser && answerData && (
          <div className="mt-3 pt-2 border-t border-slate-800/40 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
            <span>Model: {answerData.model}</span>
            <span>Latency: {answerData.latencyMs}ms</span>
            {answerData.multiHopTriggered && (
              <span className="text-purple-400">🔁 Multi-hop Pass</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
