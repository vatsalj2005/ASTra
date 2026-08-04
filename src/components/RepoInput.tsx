"use client";

import React, { useState } from "react";
import { useRepo } from "@/context/RepoContext";

const SAMPLE_REPOS = [
  { name: "expressjs/express-paginate", url: "https://github.com/expressjs/express-paginate" },
  { name: "octocat/Hello-World", url: "https://github.com/octocat/Hello-World" },
];

export function RepoInput() {
  const { startIngestion, error, clearError } = useRepo();
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

  const handleSampleClick = (url: string) => {
    setInputUrl(url);
    setValidationError("");
    clearError();
    startIngestion(url);
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-auto p-6 sm:p-8">
      {/* Glass Container Card */}
      <div className="relative rounded-2xl bg-slate-900/60 border border-slate-800/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Title & Subtitle */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 mb-4">
            <span>✨ Zero-Hallucination Code RAG</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Chat with any GitHub repository
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Ingest source code, parse AST syntax trees, perform hybrid vector + keyword search, and get grounded answers with clickable citations.
          </p>
        </div>

        {/* URL Form Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative flex items-center">
              {/* GitHub Icon */}
              <div className="absolute left-4 text-slate-400 pointer-events-none">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>

              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-12 pr-32 py-3.5 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />

              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-lg transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center gap-1.5"
              >
                <span>Ingest</span>
                <span>→</span>
              </button>
            </div>

            {(validationError || error) && (
              <p className="mt-2 text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">
                ⚠️ {validationError || error}
              </p>
            )}
          </div>
        </form>

        {/* Quick Try Sample Repos */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          <p className="text-xs font-mono text-slate-400 mb-3 text-center">
            Or try a sample public repository:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SAMPLE_REPOS.map((repo) => (
              <button
                key={repo.name}
                onClick={() => handleSampleClick(repo.url)}
                className="text-xs font-mono text-slate-300 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/40 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 group"
              >
                <span className="text-blue-400 group-hover:scale-110 transition-transform">⚡</span>
                <span>{repo.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
