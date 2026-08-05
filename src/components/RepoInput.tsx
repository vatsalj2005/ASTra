"use client";

import React, { useState } from "react";
import { useRepo } from "@/context/RepoContext";



export function RepoInput() {
  const { startIngestion, error, clearError, activeTheme } = useRepo();
  const [inputUrl, setInputUrl] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    clearError();

    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setValidationError("Please enter a GitHub repository URL.");
      return;
    }

    if (!trimmed.includes("github.com/") && !trimmed.includes("/")) {
      setValidationError("Please enter a valid GitHub repository URL (e.g. owner/repo or https://github.com/owner/repo).");
      return;
    }

    startIngestion(trimmed);
  };



  // Select blob gradient based on active theme
  const getBlobClasses = () => {
    switch (activeTheme) {
      case "amethyst":
        return {
          left: "bg-fuchsia-500/15",
          right: "bg-violet-500/15",
        };
      case "aurora":
        return {
          left: "bg-emerald-500/15",
          right: "bg-teal-500/15",
        };
      case "solar":
        return {
          left: "bg-amber-500/15",
          right: "bg-orange-500/15",
        };
      default:
        return {
          left: "bg-cyan-500/15",
          right: "bg-indigo-500/15",
        };
    }
  };

  const blobs = getBlobClasses();

  return (
    <div className="w-full max-w-4xl mx-auto my-auto p-6 sm:p-8 flex flex-col items-center justify-center relative min-h-[calc(100vh-10rem)]">
      {/* Decorative Floating Blobs */}
      <div className={`absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full ${blobs.left} blur-3xl pointer-events-none animate-blob-slow`} />
      <div className={`absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full ${blobs.right} blur-3xl pointer-events-none animate-blob-slower`} />

      {/* Glass Container Card */}
      <div className="glass-card relative rounded-3xl p-8 sm:p-12 w-full max-w-2xl overflow-hidden transition-all duration-500 z-10">
        {/* Top Decorative Border Light */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent" />

        {/* Title & Subtitle */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-[11px] font-mono text-accent-primary mb-4 transition-all duration-300">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-ping" />
            <span>✨ Zero-Hallucination Code RAG</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-4 leading-tight font-sans">
            Chat with your codebase, <br />
            <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              grounded in reality.
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Paste a public GitHub repo. We clone it, parse its AST, index vectors locally, and answer queries with exact file:line citations.
          </p>
        </div>

        {/* URL Form Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="relative flex items-center">
              {/* GitHub Icon */}
              <div className="absolute left-4 text-text-muted pointer-events-none">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>

              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  setValidationError("");
                }}
                placeholder="https://github.com/owner/repository"
                className="w-full bg-bg-primary/80 border border-card-border rounded-xl pl-12 pr-32 py-4 text-sm text-text-primary placeholder-text-muted font-mono focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all duration-300"
              />

              <button
                type="submit"
                className="absolute right-2 px-5 py-2.5 bg-gradient-to-r from-accent-primary to-accent-secondary hover:brightness-110 text-white font-mono font-bold text-xs rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ingest</span>
                <span className="text-[10px]">➔</span>
              </button>
            </div>

            {(validationError || error) && (
              <div className="mt-3 p-3.5 rounded-xl bg-error/10 border border-error/20 text-xs font-mono text-error flex items-start gap-2.5 animate-fade-in-up">
                <span>⚠️</span>
                <p className="flex-1 leading-relaxed">
                  {validationError || error}
                </p>
              </div>
            )}
          </div>
        </form>


      </div>
    </div>
  );
}
