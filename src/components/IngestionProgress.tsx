"use client";

import React from "react";
import { useRepo } from "@/context/RepoContext";

const STAGES = [
  { id: 1, label: "Cloning repository (shallow clone)" },
  { id: 2, label: "Filtering source code & docs" },
  { id: 3, label: "Parsing AST syntax trees (web-tree-sitter)" },
  { id: 4, label: "Generating local embeddings (all-MiniLM-L6-v2)" },
  { id: 5, label: "Storing vectors in ChromaDB / Local Store" },
];

export function IngestionProgress() {
  const { repoUrl, ingestionProgressStep, error, resetRepo } = useRepo();

  return (
    <div className="w-full max-w-xl mx-auto my-auto p-6">
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Ingesting Repository...
          </h2>
          <p className="text-xs font-mono text-slate-400 truncate max-w-md mx-auto">
            {repoUrl}
          </p>
        </div>

        {/* Live Step Status */}
        <div className="space-y-3 my-6 font-mono text-xs">
          {STAGES.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60"
            >
              <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-[10px]">
                ✓
              </div>
              <span className="text-slate-300">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Active Stage Indicator */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span className="truncate">{ingestionProgressStep}</span>
        </div>

        {/* Error Handler */}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-300">
            <p className="font-bold mb-1">❌ Ingestion Failed</p>
            <p className="mb-3">{error}</p>
            <button
              onClick={resetRepo}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors text-xs font-sans font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
