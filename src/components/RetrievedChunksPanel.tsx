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
    <div className="mt-3 pt-3 border-t border-slate-800/60 font-sans text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 font-mono text-slate-400 hover:text-blue-400 transition-colors py-1 group"
      >
        <span className="text-sm transition-transform duration-200" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
          ▶
        </span>
        <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-300 group-hover:text-blue-300">
          🔍 View Grounded Source Chunks ({chunks.length})
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 pl-2">
          {chunks.map((item, idx) => {
            const chunk = item.chunk;
            const sourceBadge =
              item.source === "hybrid"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : item.source === "semantic"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20";

            return (
              <div
                key={chunk.id || idx}
                className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 text-xs font-mono"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/50">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-200 font-bold">
                      {chunk.filePath}
                    </span>
                    <span className="text-slate-500">
                      Lines {chunk.startLine}-{chunk.endLine}
                    </span>
                    {chunk.symbolName && (
                      <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded text-[10px]">
                        {chunk.symbolType}: {chunk.symbolName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${sourceBadge}`}>
                      {item.source}
                    </span>
                    {item.rrfScore && (
                      <span className="text-slate-400 text-[10px]">
                        RRF: {item.rrfScore.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Code Snippet Box */}
                <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/50 text-[11px] text-slate-300 overflow-x-auto max-h-48 leading-relaxed font-mono">
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
