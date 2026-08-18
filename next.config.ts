import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@xenova/transformers",
    "onnxruntime-node",
    "chromadb",
    "@chroma-core/ai-embeddings-common",
    "@chroma-core/default-embed",
    "web-tree-sitter",
    "simple-git",
    "wink-bm25-text-search",
  ],
};

export default nextConfig;
