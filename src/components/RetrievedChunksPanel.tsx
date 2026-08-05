"use client";

import React, { useState } from "react";
import type { RetrievalResult } from "@/types";

interface RetrievedChunksPanelProps {
  chunks: RetrievalResult[];
}

export function RetrievedChunksPanel({ chunks }: RetrievedChunksPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!chunks || chunks.length === 0) return null;

  return (
    <div className="mt-4 pt-3.5 border-t border-white/5 font-sans text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 font-mono text-text-muted hover:text-accent-primary transition-colors py-1 group cursor-pointer"
      >
        <span className="text-[10px] transition-transform duration-300" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
          ▶
        </span>
        <span className="font-bold text-[10px] uppercase tracking-wider text-text-secondary group-hover:text-accent-primary transition-colors">
          🔍 Grounded Context Chunks ({chunks.length})
        </span>
      </button>

      {isOpen && (
        <div className="mt-3.5 space-y-3.5 pl-1.5 animate-fade-in-up">
          {chunks.map((item, idx) => {
            const chunk = item.chunk;
            
            // Source style logic
            let sourceBadge = "bg-accent-primary/10 text-accent-primary border-accent-primary/20";
            if (item.source === "hybrid") {
              sourceBadge = "bg-gradient-to-r from-success/20 to-teal-500/20 text-success border-success/30";
            } else if (item.source === "bm25") {
              sourceBadge = "bg-warning/10 text-warning border-warning/20";
            }

            return (
              <div
                key={chunk.id || idx}
                className="rounded-2xl bg-bg-primary border border-white/5 p-4 text-xs font-mono shadow-inner hover:border-white/10 transition-all duration-300"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3.5 mb-3 pb-2.5 border-b border-white/5">
                  <div className="flex flex-wrap items-center gap-2 truncate">
                    <span className="text-text-primary font-bold text-[11px] sm:text-xs">
                      {chunk.filePath}
                    </span>
                    <span className="text-text-muted text-[10px]">
                      Lines {chunk.startLine}-{chunk.endLine}
                    </span>
                    {chunk.symbolName && (
                      <span className="text-accent-secondary bg-accent-secondary/10 px-2 py-0.5 rounded-lg border border-accent-secondary/10 text-[9px] font-bold uppercase tracking-wide">
                        {chunk.symbolType}: {chunk.symbolName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-lg border tracking-wider ${sourceBadge}`}>
                      {item.source}
                    </span>
                    {item.rrfScore && (
                      <span className="text-text-muted text-[9px] font-semibold">
                        RRF: {item.rrfScore.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Code Snippet Box */}
                <pre className="p-3.5 rounded-xl bg-bg-secondary/70 border border-white/5 text-[11px] text-text-secondary overflow-x-auto max-h-48 leading-relaxed font-mono custom-scrollbar">
                  <code>{chunk.content}</code>
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
