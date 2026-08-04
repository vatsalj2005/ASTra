"use client";

import React, { useState } from "react";
import { useRepo } from "@/context/RepoContext";

export function RepoSidebar() {
  const { repoId, ingestionResult } = useRepo();
  const [isOpen, setIsOpen] = useState(false);

  if (!ingestionResult) return null;

  return (
    <>
      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs px-3.5 py-2.5 rounded-xl shadow-xl border border-blue-400/30 flex items-center gap-2 transition-all active:scale-95"
      >
        <span>📊</span>
        <span className="hidden sm:inline">Repo Insights</span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        />
      )}

      {/* Slide-out Sidebar Panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-80 bg-slate-950 border-l border-slate-800 p-6 z-50 overflow-y-auto transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <h3 className="font-bold text-white text-sm font-mono flex items-center gap-2">
            <span>📦</span>
            <span>Repository Metadata</span>
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 font-mono text-xs">
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
              Repository ID
            </label>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-blue-300 font-bold truncate">
              {repoId}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
              <span className="block text-xl font-bold text-white mb-0.5">
                {ingestionResult.fileCount}
              </span>
              <span className="text-[10px] text-slate-400 uppercase">Processed Files</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
              <span className="block text-xl font-bold text-blue-400 mb-0.5">
                {ingestionResult.chunkCount}
              </span>
              <span className="text-[10px] text-slate-400 uppercase">AST Chunks</span>
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-wider block mb-2">
              Chunk Distribution by Type
            </label>
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-300">Functions</span>
                <span className="text-blue-400 font-bold">{ingestionResult.chunkSummary.functions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Classes</span>
                <span className="text-purple-400 font-bold">{ingestionResult.chunkSummary.classes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Methods</span>
                <span className="text-indigo-400 font-bold">{ingestionResult.chunkSummary.methods}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Docs / Markdown</span>
                <span className="text-emerald-400 font-bold">{ingestionResult.chunkSummary.docs}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-wider block mb-2">
              Detected Languages
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ingestionResult.languages.map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px]"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
