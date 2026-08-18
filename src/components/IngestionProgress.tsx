"use client";

import React from "react";
import { useRepo } from "@/context/RepoContext";

const STAGES = [
  { id: 1, label: "Connecting & cloning repository" },
  { id: 2, label: "Filtering source files & documentation" },
  { id: 3, label: "Parsing syntax trees (web-tree-sitter)" },
  { id: 4, label: "Generating semantic embeddings (Local ONNX / Gemini)" },
  { id: 5, label: "Storing vectors in ChromaDB / Local Store" },
];

export function IngestionProgress() {
  const { repoUrl, ingestionProgressStep, error, resetRepo, activeTheme } = useRepo();

  // Helper to determine the state of each stage (completed, active, or pending)
  const getStageState = (stageId: number) => {
    const step = (ingestionProgressStep || "").toLowerCase();
    
    // Stage keywords mapping
    const mappings = [
      { id: 1, keys: ["clone", "connect", "repository"] },
      { id: 2, keys: ["filter", "file"] },
      { id: 3, keys: ["parse", "ast", "tree-sitter"] },
      { id: 4, keys: ["generate", "embed", "gemini", "minilm"] },
      { id: 5, keys: ["store", "vector", "db", "chroma"] }
    ];

    const matchedIdx = mappings.findIndex(m => m.keys.some(k => step.includes(k)));
    const activeId = matchedIdx !== -1 ? mappings[matchedIdx].id : 1;

    if (stageId < activeId) return "completed";
    if (stageId === activeId) return "active";
    return "pending";
  };

  // Determine progress bar percentage
  const getProgressPercentage = () => {
    const step = (ingestionProgressStep || "").toLowerCase();
    if (step.includes("filter")) return 30;
    if (step.includes("parse")) return 55;
    if (step.includes("generate") || step.includes("embed")) return 80;
    if (step.includes("store") || step.includes("vector")) return 95;
    return 10; // cloning/connecting
  };

  const pct = getProgressPercentage();

  // Select blob gradient based on active theme
  const getBlobColor = () => {
    switch (activeTheme) {
      case "amethyst": return "bg-fuchsia-500/10";
      case "aurora": return "bg-emerald-500/10";
      case "solar": return "bg-amber-500/10";
      default: return "bg-cyan-500/10";
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto my-auto p-6 relative">
      {/* Background Glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full ${getBlobColor()} blur-3xl pointer-events-none animate-pulse`} />

      <div className="glass-card relative rounded-3xl p-8 sm:p-10 shadow-2xl overflow-hidden z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <div className="w-6 h-6 border-[3px] border-accent-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-1.5 font-sans">
            Ingesting Repository
          </h2>
          <p className="text-xs font-mono text-text-secondary truncate max-w-md mx-auto bg-bg-secondary/60 border border-card-border px-3 py-1 rounded-full inline-block">
            {repoUrl}
          </p>
        </div>

        {/* Linear Progress Bar */}
        <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden mb-8 border border-card-border relative">
          <div
            className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary shadow-lg shadow-accent-primary/20 transition-all duration-700 ease-out rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Step Status Checklist */}
        <div className="space-y-3 font-mono text-xs mb-8">
          {STAGES.map((s) => {
            const state = getStageState(s.id);
            
            let icon = (
              <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-muted text-[10px]">
                {s.id}
              </div>
            );
            let textClass = "text-text-muted";
            let containerClass = "bg-bg-primary/20 border-transparent";

            if (state === "completed") {
              icon = (
                <div className="w-5 h-5 rounded-full bg-success/20 border border-success/30 flex items-center justify-center text-success font-bold text-[10px]">
                  ✓
                </div>
              );
              textClass = "text-text-secondary line-through opacity-60";
              containerClass = "bg-bg-primary/40 border-card-border";
            } else if (state === "active") {
              icon = (
                <div className="w-5 h-5 rounded-full bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-accent-primary font-bold text-[10px] relative">
                  <span className="absolute inset-0 rounded-full bg-accent-primary/20 animate-ping" />
                  ➔
                </div>
              );
              textClass = "text-text-primary font-semibold";
              containerClass = "bg-accent-primary/5 border-accent-primary/20";
            }

            return (
              <div
                key={s.id}
                className={`flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-300 ${containerClass}`}
              >
                {icon}
                <span className={`transition-all duration-300 ${textClass}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Current Active Status Footer */}
        <div className="p-3.5 rounded-xl bg-accent-primary/5 border border-accent-primary/10 text-xs font-mono text-accent-primary flex items-center gap-2.5 animate-pulse shadow-inner">
          <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
          <span className="truncate">{ingestionProgressStep}</span>
        </div>

        {/* Error Handler */}
        {error && (
          <div className="mt-6 p-5 rounded-2xl bg-error/10 border border-error/25 text-xs font-mono text-error animate-fade-in-up">
            <p className="font-bold mb-1.5 flex items-center gap-2">
              <span>❌</span>
              <span>Ingestion Failed</span>
            </p>
            <p className="mb-4 leading-relaxed text-text-secondary">{error}</p>
            <button
              onClick={resetRepo}
              className="px-4 py-2 bg-error hover:brightness-110 text-white rounded-xl transition-all font-sans font-semibold text-xs active:scale-95 cursor-pointer shadow-md shadow-error/20"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
