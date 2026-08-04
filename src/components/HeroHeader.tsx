"use client";

import React from "react";
import { useRepo } from "@/context/RepoContext";

export function HeroHeader() {
  const { stage, repoId, resetRepo } = useRepo();

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 font-mono font-bold text-white text-lg tracking-wider">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-xl bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                ASTra
              </span>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                RAG Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AST-Aware RAG for Public GitHub Repositories
            </p>
          </div>
        </div>

        {/* Feature Architecture Badges */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            🌳 Tree-Sitter AST
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            ⚡ Hybrid RRF
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            🦙 Llama 3.3 70B
          </span>
        </div>

        {/* Active Repo Pill & Reset */}
        {stage === "chat" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {repoId}
              </span>
            </div>
            <button
              onClick={resetRepo}
              className="text-xs font-mono text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              Change Repo
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
