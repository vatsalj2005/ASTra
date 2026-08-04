/**
 * Code Chunker Module for ASTra Ingestion Pipeline.
 *
 * Responsibilities:
 * 1. Parse code files using web-tree-sitter AST and extract complete function,
 *    class, and method boundaries as individual CodeChunk units.
 * 2. Parse Markdown documentation files (.md, README) by headers/paragraphs.
 * 3. Fallback to whole-file module chunking for unsupported/short files.
 * 4. Generate rich metadata (filePath, symbolName, symbolType, startLine, endLine).
 * 5. Log per-file chunking statistics for sanity checking.
 */

import fs from "fs";
import path from "path";
import { parseCode, detectLanguage } from "@/lib/parser";
import type { CodeChunk } from "@/types";
import type { Node } from "web-tree-sitter";

// ---------------------------------------------------------------------------
// AST Node Collector
// ---------------------------------------------------------------------------

interface ExtractedSymbol {
  symbolName: string;
  symbolType: "function" | "class" | "method";
  startLine: number;
  endLine: number;
  content: string;
}

/**
 * Traverses a Tree-sitter AST root node and extracts functions, classes, and methods.
 */
function extractASTSymbols(rootNode: Node, code: string, language: string): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  const visitedNodes = new Set<number>(); // Prevents duplicate nested extractions

  function walk(node: Node, insideClass = false) {
    if (visitedNodes.has(node.id)) return;

    const type = node.type;
    let extracted: ExtractedSymbol | null = null;

    if (language === "javascript" || language === "typescript") {
      // Function declaration: function foo() {}
      if (type === "function_declaration" || type === "generator_function_declaration") {
        const nameNode = node.childForFieldName("name");
        extracted = {
          symbolName: nameNode ? nameNode.text : "anonymousFunction",
          symbolType: insideClass ? "method" : "function",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          content: node.text,
        };
      }
      // Class declaration: class Foo {}
      else if (type === "class_declaration" || type === "class") {
        const nameNode = node.childForFieldName("name");
        extracted = {
          symbolName: nameNode ? nameNode.text : "AnonymousClass",
          symbolType: "class",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          content: node.text,
        };
        // Walk class body for internal methods
        const bodyNode = node.childForFieldName("body");
        if (bodyNode) {
          for (let i = 0; i < bodyNode.childCount; i++) {
            const child = bodyNode.child(i);
            if (child) walk(child, true);
          }
        }
      }
      // Method definition inside class/object: foo() {}
      else if (type === "method_definition") {
        const nameNode = node.childForFieldName("name");
        extracted = {
          symbolName: nameNode ? nameNode.text : "method",
          symbolType: "method",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          content: node.text,
        };
      }
      // Const / let arrow functions: const foo = () => {}
      else if (type === "lexical_declaration" || type === "variable_declaration") {
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && child.type === "variable_declarator") {
            const valueNode = child.childForFieldName("value");
            if (
              valueNode &&
              (valueNode.type === "arrow_function" ||
                valueNode.type === "function" ||
                valueNode.type === "function_expression")
            ) {
              const nameNode = child.childForFieldName("name");
              extracted = {
                symbolName: nameNode ? nameNode.text : "arrowFunction",
                symbolType: insideClass ? "method" : "function",
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                content: node.text,
              };
              break;
            }
          }
        }
      }
    } else if (language === "python") {
      // Python function definition: def foo():
      if (type === "function_definition") {
        const nameNode = node.childForFieldName("name");
        extracted = {
          symbolName: nameNode ? nameNode.text : "function",
          symbolType: insideClass ? "method" : "function",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          content: node.text,
        };
      }
      // Python class definition: class Foo:
      else if (type === "class_definition") {
        const nameNode = node.childForFieldName("name");
        extracted = {
          symbolName: nameNode ? nameNode.text : "Class",
          symbolType: "class",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          content: node.text,
        };
        // Walk class body for methods
        const bodyNode = node.childForFieldName("body");
        if (bodyNode) {
          for (let i = 0; i < bodyNode.childCount; i++) {
            const child = bodyNode.child(i);
            if (child) walk(child, true);
          }
        }
      }
    }

    if (extracted && extracted.content.trim().length > 0) {
      visitedNodes.add(node.id);
      symbols.push(extracted);
      // If we extracted a method or function, don't recurse into its inner children
      if (extracted.symbolType !== "class") {
        return;
      }
    }

    // Recurse child nodes
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) walk(child, insideClass);
    }
  }

  walk(rootNode);
  return symbols;
}

// ---------------------------------------------------------------------------
// Markdown Section Chunker
// ---------------------------------------------------------------------------

/**
 * Chunk Markdown documentation files by headers (#, ##, ###) or double linebreaks.
 */
function chunkMarkdownFile(
  repoId: string,
  filePath: string,
  content: string
): CodeChunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: CodeChunk[] = [];

  let currentHeader = "Documentation";
  let currentLines: string[] = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = /^#{1,6}\s+(.+)$/.exec(line);

    if (headerMatch) {
      // Save previous section if it has content
      if (currentLines.join("").trim().length > 0) {
        const sectionContent = currentLines.join("\n").trim();
        const endLine = i;
        chunks.push({
          id: `${repoId}:${filePath}:${startLine}`,
          repoId,
          filePath,
          language: "markdown",
          content: sectionContent,
          startLine,
          endLine,
          symbolName: currentHeader,
          symbolType: "doc",
        });
      }

      currentHeader = headerMatch[1].trim();
      currentLines = [line];
      startLine = i + 1;
    } else {
      currentLines.push(line);
    }
  }

  // Push final section
  if (currentLines.join("").trim().length > 0) {
    const sectionContent = currentLines.join("\n").trim();
    chunks.push({
      id: `${repoId}:${filePath}:${startLine}`,
      repoId,
      filePath,
      language: "markdown",
      content: sectionContent,
      startLine,
      endLine: lines.length,
      symbolName: currentHeader,
      symbolType: "doc",
    });
  }

  // Fallback: If no headers were found and only one chunk was produced
  if (chunks.length === 0 && content.trim().length > 0) {
    chunks.push({
      id: `${repoId}:${filePath}:1`,
      repoId,
      filePath,
      language: "markdown",
      content: content.trim(),
      startLine: 1,
      endLine: lines.length,
      symbolName: path.basename(filePath),
      symbolType: "doc",
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Main Public Chunker API
// ---------------------------------------------------------------------------

/**
 * Process a single file, chunking it via AST parsing (code) or section headers (docs).
 *
 * @param repoId - Identifier for the repository (e.g., "owner/repo").
 * @param repoDir - Absolute root directory of cloned repository.
 * @param relativeFilePath - Normalized relative path to file.
 * @returns Array of CodeChunk objects.
 */
export async function chunkFile(
  repoId: string,
  repoDir: string,
  relativeFilePath: string
): Promise<CodeChunk[]> {
  const fullPath = path.join(repoDir, relativeFilePath);
  if (!fs.existsSync(fullPath)) return [];

  const rawContent = fs.readFileSync(fullPath, "utf-8");
  if (!rawContent.trim()) return [];

  const totalLines = rawContent.split(/\r?\n/).length;
  const ext = path.extname(relativeFilePath).toLowerCase();

  // 1. Markdown Documentation Files
  if (ext === ".md" || ext === ".mdx" || path.basename(relativeFilePath).toLowerCase() === "readme") {
    const docChunks = chunkMarkdownFile(repoId, relativeFilePath, rawContent);
    console.log(
      `   📄 ${relativeFilePath} → ${docChunks.length} doc chunk(s)`
    );
    return docChunks;
  }

  // 2. Code Files (JS / TS / Python)
  const language = detectLanguage(relativeFilePath);
  if (language) {
    try {
      const tree = await parseCode(rawContent, language);
      const symbols = extractASTSymbols(tree.rootNode, rawContent, language);

      if (symbols.length > 0) {
        const chunks: CodeChunk[] = symbols.map((s) => ({
          id: `${repoId}:${relativeFilePath}:${s.startLine}`,
          repoId,
          filePath: relativeFilePath,
          language,
          content: s.content.trim(),
          startLine: s.startLine,
          endLine: s.endLine,
          symbolName: s.symbolName,
          symbolType: s.symbolType,
        }));

        const names = symbols.map((s) => `${s.symbolType}:${s.symbolName}`).join(", ");
        console.log(
          `   🧩 ${relativeFilePath} [${language}] → ${chunks.length} AST chunk(s) (${names})`
        );
        return chunks;
      }
    } catch (err) {
      console.warn(`Warning: AST parsing failed for ${relativeFilePath}, falling back to module chunk:`, err);
    }
  }

  // 3. Fallback: Whole-file module chunk
  const fallbackChunk: CodeChunk = {
    id: `${repoId}:${relativeFilePath}:1`,
    repoId,
    filePath: relativeFilePath,
    language: language || "text",
    content: rawContent.trim(),
    startLine: 1,
    endLine: totalLines,
    symbolName: path.basename(relativeFilePath),
    symbolType: "module",
  };

  console.log(
    `   📦 ${relativeFilePath} → 1 module chunk (fallback)`
  );
  return [fallbackChunk];
}

/**
 * Process multiple files in parallel and return all extracted chunks.
 */
export async function chunkAllFiles(
  repoId: string,
  repoDir: string,
  fileList: string[]
): Promise<CodeChunk[]> {
  console.log(`\n✂️ Chunking ${fileList.length} files...`);
  const allChunks: CodeChunk[] = [];

  for (const relativePath of fileList) {
    const fileChunks = await chunkFile(repoId, repoDir, relativePath);
    allChunks.push(...fileChunks);
  }

  console.log(`   Total chunks extracted: ${allChunks.length}`);
  return allChunks;
}
