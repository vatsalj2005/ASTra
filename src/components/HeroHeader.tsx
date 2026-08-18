"use client";

import React, { useState } from "react";
import { useRepo, ThemeType } from "@/context/RepoContext";

const THEME_OPTIONS: { id: ThemeType; label: string; dot: string; gradient: string }[] = [
  { id: "obsidian", label: "Obsidian Space", dot: "bg-cyan-400", gradient: "from-cyan-400 to-indigo-500" },
  { id: "amethyst", label: "Amethyst Midnight", dot: "bg-fuchsia-400", gradient: "from-fuchsia-400 to-violet-500" },
  { id: "aurora", label: "Emerald Aurora", dot: "bg-emerald-400", gradient: "from-emerald-400 to-teal-500" },
  { id: "solar", label: "Solar Flare", dot: "bg-amber-400", gradient: "from-amber-400 to-orange-500" },
];

export function HeroHeader() {
  const { stage, repoId, resetRepo, activeTheme, setTheme, themeMode, toggleThemeMode } = useRepo();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentTheme = THEME_OPTIONS.find((t) => t.id === activeTheme) || THEME_OPTIONS[0];

  return (
    <header className="border-b border-card-border bg-background/45 backdrop-blur-xl sticky top-0 z-30 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${currentTheme.gradient} flex items-center justify-center shadow-lg shadow-accent-primary/20 font-mono font-bold text-black text-lg tracking-wider transition-all duration-500`}>
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-mono font-extrabold text-xl bg-gradient-to-r ${currentTheme.gradient} bg-clip-text text-transparent transition-all duration-500`}>
                ASTra
              </span>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded-full transition-all duration-300">
                RAG Engine
              </span>
            </div>
            <p className="text-[10px] font-mono text-text-secondary hidden sm:block">
              AST-Aware RAG for Public GitHub Repositories
            </p>
          </div>
        </div>

        {/* Feature Architecture Badges */}
        <div className="hidden lg:flex items-center gap-2.5 text-[11px] font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-bg-secondary/60 border border-card-border text-text-secondary hover:text-text-primary hover:border-accent-primary/20 transition-all duration-300">
            🌳 Tree-Sitter AST
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-bg-secondary/60 border border-card-border text-text-secondary hover:text-text-primary hover:border-accent-primary/20 transition-all duration-300">
            ⚡ Hybrid RRF
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-bg-secondary/60 border border-card-border text-text-secondary hover:text-text-primary hover:border-accent-primary/20 transition-all duration-300">
            ⚡ Groq LLM
          </span>
        </div>

        {/* Theme System Selector & Active Repo Pill */}
        <div className="flex items-center gap-3">
          {/* Light/Dark Mode Toggle */}
          <button
            onClick={toggleThemeMode}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-bg-secondary/60 hover:bg-bg-tertiary border border-card-border hover:border-white/10 text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer active:scale-95 text-sm"
            title={themeMode === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {themeMode === "light" ? "🌙" : "☀️"}
          </button>

          {/* Custom Theme Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-secondary/60 hover:bg-bg-tertiary border border-card-border text-xs font-mono text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full ${currentTheme.dot} animate-pulse`} />
              <span className="hidden md:inline">{currentTheme.label}</span>
              <span className="text-[10px]">▼</span>
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-bg-secondary/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 p-1.5 animate-fade-in-up font-mono">
                  {THEME_OPTIONS.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => {
                        setTheme(theme.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-all duration-200 cursor-pointer ${
                        activeTheme === theme.id
                          ? "bg-accent-primary/10 text-accent-primary"
                          : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                      <span>{theme.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Active Repo pill */}
          {stage === "chat" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-xs font-mono text-accent-primary transition-all duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="truncate max-w-[100px] sm:max-w-[160px]">
                  {repoId}
                </span>
              </div>
              <button
                onClick={resetRepo}
                className="text-xs font-mono text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-xl bg-bg-secondary hover:bg-bg-tertiary border border-card-border transition-all duration-200 active:scale-95 cursor-pointer"
              >
                Exit
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
