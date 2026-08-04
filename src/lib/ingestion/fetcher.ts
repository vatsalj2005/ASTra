/**
 * Repository fetcher module for ASTra Ingestion Pipeline.
 *
 * Responsibilities:
 * 1. Parse and validate public GitHub repository URLs.
 * 2. Clone repository locally via simple-git using shallow clone (--depth 1).
 * 3. Enforce maximum size limits (e.g., 200MB cap) to prevent runaway downloads.
 * 4. Provide cleanup utilities for temporary cloned directories.
 */

import simpleGit from "simple-git";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_MAX_REPO_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
const TEMP_REPOS_DIR = path.resolve(process.cwd(), "tmp", "repos");

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  repoId: string; // e.g. "owner/repo"
  cloneUrl: string;
}

/**
 * Parse and validate a GitHub URL or "owner/repo" identifier.
 *
 * Accepts:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - owner/repo
 */
export function parseGitHubUrl(urlInput: string): ParsedRepoUrl {
  let cleaned = urlInput.trim();

  // Strip trailing slashes or .git
  if (cleaned.endsWith(".git")) {
    cleaned = cleaned.slice(0, -4);
  }
  if (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }

  // Handle owner/repo shorthand
  const shorthandMatch = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(cleaned);
  if (shorthandMatch) {
    const owner = shorthandMatch[1];
    const repo = shorthandMatch[2];
    return {
      owner,
      repo,
      repoId: `${owner}/${repo}`,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  // Handle full URL
  try {
    const urlObj = new URL(cleaned);
    if (urlObj.hostname !== "github.com" && urlObj.hostname !== "www.github.com") {
      throw new Error(`Invalid hostname "${urlObj.hostname}". Only github.com is supported.`);
    }

    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Invalid GitHub repository path: "${urlObj.pathname}". Expected owner/repo format.`);
    }

    const owner = parts[0];
    const repo = parts[1];

    return {
      owner,
      repo,
      repoId: `${owner}/${repo}`,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid hostname")) {
      throw err;
    }
    throw new Error(
      `Invalid GitHub URL "${urlInput}". Expected format: https://github.com/owner/repo`
    );
  }
}

/**
 * Recursively calculate total size of a directory in bytes.
 */
export function calculateDirSize(dirPath: string): number {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return 0;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      totalSize += calculateDirSize(fullPath);
    } else if (entry.isFile()) {
      try {
        const stats = fs.statSync(fullPath);
        totalSize += stats.size;
      } catch {
        // Ignore unreadable files
      }
    }
  }
  return totalSize;
}

// ---------------------------------------------------------------------------
// Main Public API
// ---------------------------------------------------------------------------

export interface FetchResult {
  repoDir: string;
  repoId: string;
  cloneUrl: string;
  sizeBytes: number;
}

/**
 * Clone a public GitHub repository to a temporary workspace directory.
 *
 * @param urlInput - GitHub URL or "owner/repo"
 * @param maxSizeBytes - Max allowed repository size in bytes (default: 200MB)
 */
export async function fetchRepository(
  urlInput: string,
  maxSizeBytes: number = DEFAULT_MAX_REPO_SIZE_BYTES
): Promise<FetchResult> {
  const parsed = parseGitHubUrl(urlInput);

  // Ensure root temp directory exists
  if (!fs.existsSync(TEMP_REPOS_DIR)) {
    fs.mkdirSync(TEMP_REPOS_DIR, { recursive: true });
  }

  // Format destination folder name: owner_repo
  const folderName = `${parsed.owner}_${parsed.repo}`;
  const repoDir = path.join(TEMP_REPOS_DIR, folderName);

  // If previous clone exists, remove it cleanly
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  console.log(`\n📥 Fetching repository: ${parsed.cloneUrl}`);
  console.log(`   Destination: ${repoDir}`);

  const git = simpleGit();

  // Test remote repository availability
  try {
    await git.listRemote([parsed.cloneUrl]);
  } catch (err) {
    throw new Error(
      `Failed to access repository "${parsed.cloneUrl}". Ensure it is public and valid. ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Perform shallow clone
  try {
    await git.clone(parsed.cloneUrl, repoDir, ["--depth", "1"]);
  } catch (err) {
    // Cleanup if partial clone left files behind
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
    throw new Error(
      `Failed to clone repository: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Size cap verification
  const sizeBytes = calculateDirSize(repoDir);
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`   Repository size: ${sizeMB} MB`);

  if (sizeBytes > maxSizeBytes) {
    cleanupRepository(repoDir);
    const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    throw new Error(
      `Repository "${parsed.repoId}" exceeds maximum size cap of ${maxMB}MB (${sizeMB}MB actual). Aborting ingestion.`
    );
  }

  return {
    repoDir,
    repoId: parsed.repoId,
    cloneUrl: parsed.cloneUrl,
    sizeBytes,
  };
}

/**
 * Remove a temporary cloned repository directory.
 */
export function cleanupRepository(repoDir: string): void {
  if (fs.existsSync(repoDir)) {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up temporary repository folder: ${repoDir}`);
    } catch (err) {
      console.warn(`Warning: Could not delete ${repoDir}:`, err);
    }
  }
}
