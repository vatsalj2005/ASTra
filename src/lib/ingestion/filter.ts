/**
 * File filter module for ASTra Ingestion Pipeline.
 *
 * Responsibilities:
 * 1. Walk directory tree recursively.
 * 2. Filter files based on configurable rules (ignore lists, size caps, allowed extensions).
 * 3. Include source code files (.py, .js, .ts, .jsx, .tsx), README, and markdown docs.
 * 4. Exclude binaries, images, lockfiles, minified files, node_modules, and build outputs.
 */

import fs from "fs";
import path from "path";
import type { FilterConfig } from "@/types";

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_FILTER_CONFIG: Required<FilterConfig> = {
  ignoredDirectories: [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "out",
    "coverage",
    "vendor",
    "__pycache__",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    "tmp",
  ],
  ignoredExtensions: [
    ".lock",
    ".min.js",
    ".min.css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".wasm",
    ".pyc",
    ".map",
    ".mp4",
    ".mov",
    ".mp3",
    ".wav",
    ".ttf",
    ".woff",
    ".woff2",
  ],
  ignoredFilenames: [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "Pipfile.lock",
    "poetry.lock",
    ".DS_Store",
    "Thumbs.db",
  ],
  allowedCodeExtensions: [
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".cpp",
    ".c",
    ".cc",
    ".h",
    ".hpp",
    ".cs",
    ".rb",
    ".php",
    ".swift",
    ".kt",
  ],
  allowedDocFilenames: ["README.md", "readme.md", "README"],
  allowedDocExtensions: [".md", ".mdx"],
  maxFileSizeBytes: 500 * 1024, // 500 KB per file
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Merge user custom FilterConfig with default rules.
 */
export function resolveFilterConfig(
  userConfig?: FilterConfig
): Required<FilterConfig> {
  if (!userConfig) return DEFAULT_FILTER_CONFIG;

  return {
    ignoredDirectories:
      userConfig.ignoredDirectories || DEFAULT_FILTER_CONFIG.ignoredDirectories,
    ignoredExtensions:
      userConfig.ignoredExtensions || DEFAULT_FILTER_CONFIG.ignoredExtensions,
    ignoredFilenames:
      userConfig.ignoredFilenames || DEFAULT_FILTER_CONFIG.ignoredFilenames,
    allowedCodeExtensions:
      userConfig.allowedCodeExtensions || DEFAULT_FILTER_CONFIG.allowedCodeExtensions,
    allowedDocFilenames:
      userConfig.allowedDocFilenames || DEFAULT_FILTER_CONFIG.allowedDocFilenames,
    allowedDocExtensions:
      userConfig.allowedDocExtensions || DEFAULT_FILTER_CONFIG.allowedDocExtensions,
    maxFileSizeBytes:
      userConfig.maxFileSizeBytes ?? DEFAULT_FILTER_CONFIG.maxFileSizeBytes,
  };
}

/**
 * Test whether a file should be included in ingestion processing.
 */
export function shouldIncludeFile(
  relativePath: string,
  fullPath: string,
  config: Required<FilterConfig>
): { include: boolean; reason?: string } {
  const fileName = path.basename(relativePath);
  const ext = path.extname(relativePath).toLowerCase();

  // 1. Check exact ignored filename
  if (config.ignoredFilenames.includes(fileName)) {
    return { include: false, reason: "Ignored filename" };
  }

  // 2. Check minified file pattern (*.min.js, *.min.css)
  if (relativePath.includes(".min.")) {
    return { include: false, reason: "Minified file" };
  }

  // 3. Check ignored extension
  if (config.ignoredExtensions.includes(ext)) {
    return { include: false, reason: "Ignored extension" };
  }

  // 4. Check file size cap
  try {
    const stats = fs.statSync(fullPath);
    if (stats.size > config.maxFileSizeBytes) {
      const sizeKB = (stats.size / 1024).toFixed(1);
      return { include: false, reason: `File size exceeds cap (${sizeKB} KB)` };
    }
  } catch {
    return { include: false, reason: "Unreadable file stats" };
  }

  // 5. Check allowed code extensions
  if (config.allowedCodeExtensions.includes(ext)) {
    return { include: true };
  }

  // 6. Check allowed doc filenames / doc extensions
  if (config.allowedDocFilenames.includes(fileName)) {
    return { include: true };
  }

  if (config.allowedDocExtensions.includes(ext)) {
    // Only include markdown files if they are in docs/ directory or root directory
    const dir = path.dirname(relativePath);
    if (dir === "." || dir.startsWith("docs") || dir.startsWith("doc")) {
      return { include: true };
    }
  }

  return { include: false, reason: "Extension not in allowlist" };
}

// ---------------------------------------------------------------------------
// Main Public API
// ---------------------------------------------------------------------------

/**
 * Walk repository directory and return relative paths of all files passing filter rules.
 *
 * @param repoDir - Absolute path to cloned repository root.
 * @param userConfig - Optional custom FilterConfig overrides.
 * @returns Array of relative file paths (normalized with forward slashes).
 */
export async function getFilteredFileList(
  repoDir: string,
  userConfig?: FilterConfig
): Promise<string[]> {
  const config = resolveFilterConfig(userConfig);
  const resultFiles: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path
        .relative(repoDir, fullPath)
        .replace(/\\/g, "/"); // Normalize Windows backslashes to /

      if (entry.isDirectory()) {
        // Skip ignored directories
        if (config.ignoredDirectories.includes(entry.name)) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const check = shouldIncludeFile(relativePath, fullPath, config);
        if (check.include) {
          resultFiles.push(relativePath);
        }
      }
    }
  }

  walk(repoDir);

  // Sort files for deterministic processing order
  resultFiles.sort();
  return resultFiles;
}
