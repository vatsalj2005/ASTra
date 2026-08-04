# Ask My Codebase (ragedit)

> Chat with any public GitHub repository in natural language. Get answers grounded in real code with file:line citations — not hallucinations.

[![Built with Next.js](https://img.shields.io/badge/Next.js-App_Router-black?logo=next.js)](https://nextjs.org)
[![LLM: Groq](https://img.shields.io/badge/LLM-Groq_Llama_3.3-orange)](https://console.groq.com)
[![Embeddings: Local](https://img.shields.io/badge/Embeddings-all--MiniLM--L6--v2-blue)](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What Is This?

Paste a public GitHub repo URL → the system ingests the entire codebase → you ask natural-language questions → you get answers with **exact file:line citations** pointing to the source code.

This is a **production-grade RAG (Retrieval-Augmented Generation)** system, not a basic tutorial clone. Key differentiators:

| Feature | Why It Matters |
|---|---|
| **AST-aware chunking** (tree-sitter) | Code is split by function/class boundaries, not arbitrary character counts. Every retrieval hit is a complete, coherent unit of code. |
| **Hybrid retrieval** (semantic + BM25) | Semantic search catches paraphrases ("authentication" ↔ "login"). BM25 catches exact identifiers (`handleOAuth2Callback`). Together they outperform either alone. |
| **Grounded citations** | Every claim in an answer cites `file:line`. The LLM is instructed to say "I don't know" when retrieval confidence is low. |
| **Multi-hop retrieval** | If an answer references another function/file, the system automatically does a second retrieval pass to gather full context. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                      │
│  Paste repo URL → Ingestion progress → Chat UI → Cited answers  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    ┌─────────────┐  ┌────────────┐  ┌──────────────┐
    │  INGESTION   │  │ RETRIEVAL  │  │  GENERATION   │
    │              │  │            │  │               │
    │ Clone repo   │  │ Embed query│  │ Build prompt  │
    │ Filter files │  │ Semantic   │  │ w/ retrieved  │
    │ Parse AST    │  │  search    │  │ chunks +      │
    │ Chunk by fn/ │  │ BM25 search│  │ file:line     │
    │  class       │  │ RRF fusion │  │ metadata      │
    │ Embed chunks │  │ Multi-hop  │  │ Call Groq LLM │
    │ Store        │  │            │  │ Parse citations│
    └──────┬───────┘  └─────┬──────┘  └──────┬────────┘
           │                │                │
           ▼                ▼                ▼
    ┌─────────────────────────────────────────────┐
    │         STORAGE (ChromaDB / Supabase)        │
    │  Embeddings + BM25 index + chunk metadata    │
    └─────────────────────────────────────────────┘
```

---

## Tech Stack

Everything is **free-tier / open-source / locally-run**. No credit card required.

| Layer | Technology | Why This Choice |
|---|---|---|
| Framework | **Next.js** (App Router, TypeScript) | Full-stack in one project — SSR, API routes, React UI. Industry standard for portfolio projects. |
| LLM | **Groq** (Llama 3.3 70B, free tier) | Fastest inference API, generous free tier. Swappable to Ollama for offline use. |
| Embeddings | **@xenova/transformers** (all-MiniLM-L6-v2) | Runs locally via ONNX/WASM — zero API cost, ~384-dim vectors, excellent quality for code search. |
| Code Parsing | **web-tree-sitter** (WASM) | AST parsing without native compilation. Supports JS, TS, Python (extensible). |
| Vector Store | **ChromaDB** (local dev) / **Supabase pgvector** (production) | ChromaDB: zero setup for dev. Supabase: free hosted pgvector for demos. |
| Keyword Search | **wink-bm25-text-search** | Robust JS-native BM25 for hybrid retrieval alongside vector search. |
| Repo Cloning | **simple-git** | Programmatic git clone/fetch — handles shallow clones, branch selection. |

### Why All-JavaScript? (No Python Sidecar)

The typical RAG tutorial uses Python for everything. We chose to keep the entire stack in JavaScript/TypeScript because:

1. **One runtime, one `package.json`, one deploy** — dramatically simpler for a solo developer.
2. `@xenova/transformers` runs the same ONNX model as Python's `sentence-transformers`, just via WASM. For repo-scale data (thousands of chunks), the ~2-3x speed difference is negligible.
3. `web-tree-sitter` provides the same AST parsing as native tree-sitter, without `node-gyp` headaches on Windows/CI.
4. Portfolio reviewers can `git clone` → `npm install` → `npm run dev` with zero Python setup.

**Tradeoff**: If processing speed becomes a bottleneck on very large repos, Ollama embeddings or a Python subprocess can be swapped in without restructuring the codebase.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/health/         # Health check endpoint
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
│
├── lib/                    # Core business logic (framework-agnostic)
│   ├── ingestion/          # Repo cloning, file filtering, AST chunking
│   ├── retrieval/          # Hybrid search (semantic + BM25), reranking
│   ├── generation/         # LLM prompt construction, Groq API calls
│   ├── embeddings/         # Embedding model wrapper (@xenova/transformers)
│   ├── parser/             # Tree-sitter wrapper (web-tree-sitter WASM)
│   └── vector-store/       # Storage abstraction (ChromaDB / Supabase)
│
└── types/                  # Shared TypeScript interfaces
    └── index.ts            # CodeChunk, RetrievalResult, Citation, etc.

scripts/
└── verify-env.ts           # Standalone CLI health check

grammars/                   # Tree-sitter WASM grammar files (built from source)
```

**Why `src/lib/`?** Business logic is isolated from the Next.js framework. Each module maps 1:1 to an architecture component, making the code self-documenting and independently testable.

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18 (tested on 24.x)
- **npm** ≥ 9
- **Docker** (optional — used by `tree-sitter build --wasm` if Emscripten isn't installed)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/ragedit.git
cd ragedit

# 2. Install dependencies
npm install

# 3. Build tree-sitter WASM grammars
npm run setup:grammars

# 4. Create your environment file
cp .env.local.example .env.local
# Edit .env.local and add your Groq API key (get one free at https://console.groq.com)

# 5. Start the dev server
npm run dev

# 6. Verify everything works
# Option A: API health check
curl http://localhost:3000/api/health

# Option B: CLI verification
npx tsx scripts/verify-env.ts
```

### Expected Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2026-08-05T...",
  "checks": {
    "nextjs": true,
    "embedding": {
      "ok": true,
      "model": "Xenova/all-MiniLM-L6-v2",
      "dimension": 384,
      "latencyMs": 1200
    },
    "treeSitter": {
      "ok": true,
      "languages": ["javascript", "typescript", "python"],
      "testNodeCount": 15
    }
  }
}
```

---

## Roadmap

- [x] **Phase 0**: Project skeleton — Next.js, dependencies, health checks, module stubs
- [ ] **Phase 1**: Ingestion pipeline — clone repo, filter, parse AST, chunk, embed, store
- [ ] **Phase 2**: Retrieval pipeline — semantic search, BM25, reciprocal rank fusion, multi-hop
- [ ] **Phase 3**: Generation pipeline — prompt construction, Groq API, citation extraction
- [ ] **Phase 4**: Frontend — paste-URL screen, ingestion progress, chat UI, cited answers
- [ ] **Phase 5**: Polish — error handling, rate limiting, caching, performance tuning

---

## Design Decisions & Tradeoffs

### Why AST Chunking Over Fixed-Size Chunks?
Fixed-size chunks (e.g., "split every 1000 characters") often break code mid-expression, producing fragments like `...return user.id;\n}\n\nfunction calculateTax(` that are meaningless in isolation. AST-aware chunking using tree-sitter ensures every chunk is a complete function, class, or method — a coherent unit that an LLM can reason about and that a developer can verify.

### Why Hybrid Retrieval (Not Just Embeddings)?
Pure semantic search misses exact identifiers. If a user asks "where is `handleOAuth2Callback` defined?", embedding similarity might surface generically related auth code but miss the exact function. BM25 lexical search catches these exact matches. Reciprocal Rank Fusion (RRF) merges both result sets, consistently outperforming either approach alone in retrieval benchmarks.

### Why "Cite or Say I Don't Know"?
RAG systems that allow unconstrained generation produce plausible-sounding but fabricated answers. By requiring file:line citations for every claim and instructing the model to decline when context is insufficient, we maintain the trust that makes a code Q&A tool actually useful.

---

## License

MIT
