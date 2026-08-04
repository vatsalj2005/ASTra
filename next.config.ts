import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "chromadb",
    "@chroma-core/ai-embeddings-common",
    "@chroma-core/default-embed",
    "@xenova/transformers",
    "web-tree-sitter",
    "simple-git",
    "wink-bm25-text-search",
    "onnxruntime-node",
  ],
};

export default nextConfig;
