"use client";

import React, { useState } from "react";
import { useRepo } from "@/context/RepoContext";

export function RepoSidebar() {
  const { repoId, ingestionResult } = useRepo();
  const [isOpen, setIsOpen] = useState(false);

  if (!ingestionResult) return null;

  const total = ingestionResult.chunkCount || 1;
  const fnPct = Math.round((ingestionResult.chunkSummary.functions / total) * 100);
  const clsPct = Math.round((ingestionResult.chunkSummary.classes / total) * 100);
  const mthPct = Math.round((ingestionResult.chunkSummary.methods / total) * 100);
  const docPct = Math.round((ingestionResult.chunkSummary.docs / total) * 100);

  return (
    <>
      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-accent-primary to-accent-secondary hover:brightness-110 text-white font-mono text-xs px-4 py-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
      >
        <span>📊</span>
        <span className="hidden sm:inline">Repo Insights</span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-fade-in"
        />
      )}

      {/* Slide-out Sidebar Panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-80 bg-bg-secondary/95 border-l border-white/5 p-6 z-50 overflow-y-auto transition-transform duration-300 backdrop-blur-2xl shadow-2xl flex flex-col justify-between ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
            <h3 className="font-bold text-text-primary text-sm font-mono flex items-center gap-2">
              <span>📊</span>
              <span>Repo Insights</span>
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-text-primary p-1.5 rounded-lg bg-white/5 border border-white/10 transition-colors cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6 font-mono text-xs">
            <div>
              <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1.5 font-semibold">
                Repository Name
              </label>
              <div className="p-3 rounded-xl bg-bg-primary border border-white/5 text-accent-primary font-bold truncate shadow-inner">
                {repoId}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-bg-primary border border-white/5 text-center shadow-inner">
                <span className="block text-xl font-extrabold text-text-primary mb-0.5">
                  {ingestionResult.fileCount}
                </span>
                <span className="text-[9px] text-text-muted uppercase font-semibold block leading-tight">Files</span>
              </div>
              <div className="p-3.5 rounded-xl bg-bg-primary border border-white/5 text-center shadow-inner">
                <span className="block text-xl font-extrabold text-accent-secondary mb-0.5">
                  {ingestionResult.chunkCount}
                </span>
                <span className="text-[9px] text-text-muted uppercase font-semibold block leading-tight">Chunks</span>
              </div>
            </div>

            <div>
              <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-3 font-semibold">
                Chunk Breakdown
              </label>
              <div className="space-y-3.5 p-4 rounded-xl bg-bg-primary border border-white/5 shadow-inner">
                {/* Functions Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-secondary">Functions</span>
                    <span className="text-accent-primary font-bold">{ingestionResult.chunkSummary.functions} ({fnPct}%)</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-primary rounded-full" style={{ width: `${fnPct}%` }} />
                  </div>
                </div>

                {/* Classes Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-secondary">Classes</span>
                    <span className="text-accent-secondary font-bold">{ingestionResult.chunkSummary.classes} ({clsPct}%)</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-secondary rounded-full" style={{ width: `${clsPct}%` }} />
                  </div>
                </div>

                {/* Methods Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-secondary">Methods</span>
                    <span className="text-purple-400 font-bold">{ingestionResult.chunkSummary.methods} ({mthPct}%)</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full" style={{ width: `${mthPct}%` }} />
                  </div>
                </div>

                {/* Docs Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-secondary">Markdown Docs</span>
                    <span className="text-success font-bold">{ingestionResult.chunkSummary.docs} ({docPct}%)</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${docPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-2.5 font-semibold">
                Detected Languages
              </label>
              <div className="flex flex-wrap gap-2">
                {ingestionResult.languages.map((lang) => (
                  <span
                    key={lang}
                    className="px-2.5 py-1 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[10px] font-bold uppercase tracking-wider"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-white/5 text-[9px] font-mono text-text-muted text-center leading-relaxed">
          ASTra RAG Engine v0.1.0 <br />
          Parsed via web-tree-sitter WASM
        </div>
      </aside>
    </>
  );
}
