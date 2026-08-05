"use client";

import React from "react";
import { useRepo } from "@/context/RepoContext";

interface CitationLinkProps {
  filePath: string;
  startLine: number;
  endLine?: number;
}

export function CitationLink({ filePath, startLine, endLine }: CitationLinkProps) {
  const { repoId } = useRepo();

  // Construct GitHub blob link: https://github.com/owner/repo/blob/main/filePath#LstartLine-LendLine
  const lineRange = endLine && endLine !== startLine ? `L${startLine}-L${endLine}` : `L${startLine}`;
  const githubUrl = repoId
    ? `https://github.com/${repoId}/blob/main/${filePath}#${lineRange}`
    : `#`;

  const displayTag = endLine && endLine !== startLine
    ? `${filePath}:${startLine}-${endLine}`
    : `${filePath}:${startLine}`;

  return (
    <a
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${displayTag} on GitHub`}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] font-semibold text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/20 hover:border-accent-primary px-2.5 py-0.5 rounded-lg transition-all cursor-pointer mx-1 align-baseline group shadow-sm active:scale-95"
    >
      <span className="text-[10px] transform group-hover:scale-110 transition-transform">📄</span>
      <span>{displayTag}</span>
      <span className="text-[9px] text-accent-primary/60 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">↗</span>
    </a>
  );
}
