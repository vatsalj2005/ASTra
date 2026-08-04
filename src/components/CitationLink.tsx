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
      className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-400 px-2 py-0.5 rounded transition-all cursor-pointer mx-1 align-baseline group"
    >
      <span className="text-blue-400 group-hover:scale-110 transition-transform">📄</span>
      <span>{displayTag}</span>
      <span className="text-[10px] text-blue-300/60">↗</span>
    </a>
  );
}
