# NestJS Weaviate Agent — Technical Reference

This document describes the codebase end to end: purpose, architecture, modules, data flows, Weaviate usage, agent graph, APIs, configuration, testing, and operational notes. It is the companion to the shorter [README.md](../README.md) quick start.

---

## 1. Purpose

Deliver a **backend-only** demonstration of:

- **NestJS** HTTP API with validation and modular services.
- **Weaviate** as a multi-tenant knowledge store for RAG-style retrieval.
- **LangGraph** (`StateGraph`) for a **delegating agent** with explicit typed state.
- **LangChain** abstractions for LLM calls (**Google Gemini** when configured).
- **Server-Sent Events (SSE)**-style streaming on **`POST /api/chat`**, with every chunk shaped as `{ "answer": string, "data": object[] }`.

The product brief (assessment) emphasized deterministic routing first, honest retrieval labeling (no “semantic search” when using keyword fallback), mocked Chart.js output, and tests for routing, references, ranking, chart shape, and streaming.

---

## 2. Technology Stack

| Layer | Choice |
|--------|--------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | NestJS 11 (`@nestjs/common`, `core`, `platform-express`, `config`) |
| Validation | `class-validator` + `class-transformer`, global `ValidationPipe` |
| Vector DB | Weaviate via official `weaviate-client` (v3.x) |
| Orchestration | `@langchain/langgraph` (`StateGraph`, `Annotation`) |
| LLM | `@langchain/google-genai` (`ChatGoogleGenerativeAI`) + injectable mock |
| Testing | Jest, Supertest, `@nestjs/testing` |

---

## 3. Repository Layout

```
nestjs-weaviate/
├── docker-compose.yml          # Local Weaviate (and optional modules — see §12)
├── .env / .env.example         # Environment (not committed: .env)
├── package.json                # Scripts: build, start:dev, test, db:init, db:seed
├── tsconfig.json               # Base TS config; paths `src/*`
├── tsconfig.build.json         # App build; `tsBuildInfoFile` under `dist/` (incremental safe with Nest deleteOutDir)
├── nest-cli.json               # Nest CLI; `deleteOutDir` on build
├── eslint.config.mjs
├── README.md                   # Quick start, curl examples
├── docs/
│   └── PROJECT_REFERENCE.md    # This file
├── scripts/
│   ├── init-weaviate.ts        # Bootstrap Nest context → SchemaService
│   └── seed-weaviate.ts        # Seed if tenant empty
├── test/                       # Unit specs + e2e
│   ├── *.spec.ts
│   ├── chat.stream.e2e-spec.ts
│   └── jest-e2e.json
└── src/
    ├── main.ts                 # `reflect-metadata`, ValidationPipe, listen PORT
    ├── app.module.ts           # Config, Weaviate, Llm, Health, Chat
    ├── common/
    │   ├── constants.ts        # AGENT_KNOWLEDGE_COLLECTION, DEMO_TENANT_ID
    │   └── config/env.validation.ts
    ├── types/agent.types.ts    # AgentIntent, AgentData union, StreamPayload
    ├── health/
    ├── chat/                   # Controller, service, DTO
    ├── agents/
    │   ├── delegating/         # routing, LangGraph, agent service
    │   └── rag/                # RAG service, ranking, references
    ├── tools/chart/            # Mock Chart.js
    ├── db/weaviate/            # Client, schema, seed
    └── llm/                    # Interface, Gemini, mock, factory
```

---

## 4. Application Bootstrap

**`src/main.ts`**

- Imports `reflect-metadata` (required for Nest decorators / DI).
- Creates the Nest application with `AppModule`.
- Registers a **global `ValidationPipe`** (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Reads **`PORT`** from `ConfigService` (default 3000).

**`src/app.module.ts`**

- **`ConfigModule.forRoot({ validate: validateEnv })`** — loads `.env` and validates/coerces typed `EnvironmentVariables` (`common/config/env.validation.ts`).
- Imports in order: **`WeaviateModule`** (global), **`LlmModule`**, **`HealthModule`**, **`ChatModule`**.

---

## 5. Modules and Responsibilities

### 5.1 `WeaviateModule` (`src/db/weaviate/`)

- **Global** module: exports **`WeaviateService`**, **`SchemaService`**, **`SeedService`**.
- **`WeaviateService`**
  - On module init: **`connectToLocal`** from `weaviate-client` using `WEAVIATE_HTTP_HOST`, `WEAVIATE_HTTP_PORT`, `WEAVIATE_GRPC_PORT`.
  - **Retries** connection up to **120** times with **1s** delay (~2 minutes) if Weaviate is not up yet (e.g. Docker starting).
  - After connect, **`waitUntilReady`** polls **`client.isReady()`** (HTTP `/.well-known/ready`).
  - Exposes **`getClient()`** and **`getKnowledgeCollectionForTenant(tenantId)`** — always uses the **tenant-scoped** collection handle: `client.collections.use(AgentKnowledge).withTenant(tenantId)`.
- **`SchemaService.ensureSchemaAndDemoTenant()`**
  - Creates collection **`AgentKnowledge`** if missing: multi-tenancy enabled, **`weaviate.configure.vectors.none()`** (no automatic vectors for this collection).
  - Properties: **`fileId`**, **`question`**, **`answer`**, **`pageNumber`** (`text[]`).
  - **`fileId`**: `skipVectorization: true`, `indexSearchable: false`, `indexFilterable: false` (metadata-style; **do not** set deprecated `indexInverted` together with those flags on current Weaviate versions).
  - Ensures tenant **`tenant-demo`** exists.
- **`SeedService`**: inserts fictional rows into **`tenant-demo`** (used by `npm run db:seed`).

### 5.2 `LlmModule` (`src/llm/`)

- **`LlmProvider` interface** (`llm-provider.interface.ts`): `streamAnswer(prompt)`, `invokeAnswer(prompt)`.
- **`GeminiLlmProvider`**: builds **`ChatGoogleGenerativeAI`** when **`GOOGLE_API_KEY`** is set; streams/invokes with **`HumanMessage`**. On missing key or API failure, falls back to short deterministic **offline** strings (no crash).
- **`MockLlmProvider`**: test/deterministic provider.
- **`llmProviderBinding`**: `LLM_PROVIDER` injection token — returns **`MockLlmProvider`** if **`LLM_PROVIDER=mock`**, else **`GeminiLlmProvider`**.

### 5.3 `HealthModule`

- **`GET /health`** → `{ "status": "ok" }`.

### 5.4 `ChatModule`

- Wires **`ChatController`**, **`ChatService`**, **`RagAgentService`**, **`ChartToolService`**, **`DelegatingAgentService`**.

---

## 6. HTTP API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness-style JSON |
| POST | `/api/chat` | Streaming chat (SSE body) |

**`POST /api/chat` body (`ChatDto`)**

- **`query`**: string, required, min length 1.
- **`tenantId`**: string, required (validation error if missing/empty).

**Streaming**

- **`Content-Type: text/event-stream; charset=utf-8`**
- Each event: **`data: `** + **single JSON object** + **`\n\n`**
- JSON shape: **`StreamPayload`**: `{ "answer": string, "data": AgentData[] }`
  - First useful chunk may have **`answer: ""`** and full **`data`** once tools/RAG have run.
  - Later chunks **accumulate** `answer`; **`data`** repeats the **full** current array (per brief).

**Errors during stream**

- Controller catches errors and emits one final `data:` line with `answer` containing the error message and `data: []`.

---

## 7. End-to-End Request Flow

1. **Client** sends `POST /api/chat` with `query` + `tenantId`.
2. **`ChatService.streamChat`**
   - Calls **`DelegatingAgentService.run(query, tenantId)`** → runs the **compiled LangGraph** (see §8).
   - Receives final graph state: **`data`** (references and/or chart), **`streamingPrompt`**.
   - Yields **`{ answer: "", data }`** so clients see structured refs/chart immediately.
   - Streams text from **`llm.streamAnswer(streamingPrompt)`**, yielding **`{ answer: accumulated, data }`** after each chunk.
3. **Controller** writes each payload as SSE.

---

## 8. Delegating Agent (LangGraph)

**File:** `src/agents/delegating/delegating.graph.ts`

**State schema (`Annotation.Root`)**

| Field | Role |
|-------|------|
| `query` | User text |
| `tenantId` | Weaviate tenant |
| `intent` | Result of routing (`AgentIntent`) |
| `data` | `AgentData[]` — `rag_reference` and/or `chartjs` |
| `ragContextBlock` | Concatenated retrieval context for the LLM (not sent raw to client except via answer) |
| `streamingPrompt` | Final instruction string for the LLM |

**Graph topology (linear)**

```
START → classifyIntent → executeTools → preparePrompt → END
```

- **`classifyIntent`**: sets **`intent`** via **`classifyIntent(query)`** from `routing.ts`.
- **`executeTools`**: based on **`intent`**, may:
  - **direct**: empty `data`.
  - **rag**: **`RagAgentService.retrieveAndPrepare`** → fills **`data`** with **`rag_reference`** entries, **`ragContextBlock`**.
  - **chart**: **`ChartToolService.buildMockChart()`** → one **`chartjs`** in **`data`**.
  - **rag_chart_parallel**: **`Promise.all`** RAG + chart mock; **`data`** = references then chart.
  - **rag_chart_sequential**: RAG then chart (order preserved in **`data`**); same data shape as parallel for this demo.
- **`preparePrompt`**: builds **`streamingPrompt`** strings per intent (direct / RAG / chart / combined), including citation instructions for RAG paths.

**`DelegatingAgentService`** (`delegating-agent.service.ts`) constructs the graph once with injected **`RagAgentService`** and **`ChartToolService`**, and exposes **`run(query, tenantId)`** → **`graph.invoke(...)`** with initial empty `data` and undefined intent (filled by first node).

---

## 9. Routing (`src/agents/delegating/routing.ts`)

Deterministic-first rules (regex/keywords):

- **Greetings / meta** (“hello”, “what can you do”) → **`direct`**.
- **Chart** keywords (`chart`, `graph`, `plot`, …) and **RAG** keywords (`manual`, `documents`, `knowledge`, …):
  - If both: **`chartDependsOnRetrieval(query)`** → **`rag_chart_sequential`** else **`rag_chart_parallel`**.
- Chart only → **`chart`**.
- RAG only → **`rag`**.
- Short non-question text → **`direct`**; otherwise default → **`rag`**.

`chartDependsOnRetrieval` detects phrases like “from the documents”, “based on the manual”, etc.

---

## 10. RAG Pipeline (`src/agents/rag/`)

### 10.1 Retrieval (honest labeling)

- All reads use **`getKnowledgeCollectionForTenant(tenantId).query.fetchObjects({ limit: 500 })`** (tunable).
- The **`AgentKnowledge`** collection is created with **`vectors.none()`** — the app does **not** rely on Weaviate vector search for this demo.
- **Ranking** (`ranking.ts`): tokenizes the query (lowercased alphanumerics), scores **only** **`question`** and **`answer`** text. **`fileId` is never used for matching.** Scoring favors phrase matches and repeated token hits.
- Top **K** records (default **4** in the graph) feed **`references.ts`**.

### 10.2 References and citations (`references.ts`)

- **`buildRagReferences`**: groups by **`fileId`**, merges **`pageNumber`** values, orders sources by first appearance, assigns **`sourceNumber`** (1-based).
- **`formatPageCitationLabel`** / **`inlineCitationForSource`**: human strings like **`1- Page 12`**, **`2- Pages 7, 8`**.

### 10.3 `RagAgentService`

- Maps Weaviate objects to **`WeaviateKnowledgeRecord`**.
- If keyword scores yield **no** matches, logs a warning and falls back to **first N stored objects** so the demo still returns something (explicitly documented as fallback behavior).

---

## 11. Chart Tool (`src/tools/chart/chart.tool.ts`)

- **`buildMockChart()`** returns **`AgentData`** variant **`{ type: "chartjs", chartId, config }`**.
- **`config`** is a fixed **bar chart** Chart.js JSON object (no server-side rendering).

---

## 12. Weaviate Schema Summary

| Item | Value |
|------|--------|
| Collection name | `AgentKnowledge` (constant `AGENT_KNOWLEDGE_COLLECTION`) |
| Multi-tenancy | Enabled |
| Demo tenant | `tenant-demo` (`DEMO_TENANT_ID`) |
| Vectorizer for this collection | `none` (via `configure.vectors.none()`) |
| Properties | `fileId` (text), `question` (text), `answer` (text), `pageNumber` (text array) |

**Docker:** `docker-compose.yml` in the repo may be **minimal Weaviate-only** or **extended** (e.g. `text2vec-transformers` sidecar). The **application schema** for `AgentKnowledge` remains **unvectorized**; optional vector modules in Compose do not change this app’s retrieval path unless you refactor to use them.

---

## 13. Scripts

| Script | Command | Behavior |
|--------|---------|----------|
| Init schema | `npm run db:init` | `NestFactory.createApplicationContext` → **`SchemaService.ensureSchemaAndDemoTenant()`** |
| Seed | `npm run db:seed` | If tenant has **no** objects, **`SeedService.seedDemoTenant()`**; else skip |

Both scripts import **`reflect-metadata`** before Nest bootstrap.

---

## 14. Environment Variables

Validated in **`env.validation.ts`** (with coercion for numeric ports):

| Variable | Typical role |
|----------|----------------|
| `PORT` | HTTP server (default 3000) |
| `WEAVIATE_HTTP_HOST` | Default `localhost` |
| `WEAVIATE_HTTP_PORT` | Default `8080` |
| `WEAVIATE_GRPC_PORT` | Default `50051` |
| `GOOGLE_API_KEY` | Optional — enables Gemini |
| `GEMINI_MODEL` | Model id (default `gemini-2.0-flash`) |
| `LLM_PROVIDER` | `gemini` (default) or `mock` |

Copy **`.env.example`** to **`.env`** for local work.

---

## 15. Testing

| Suite | Location | Focus |
|-------|----------|--------|
| Unit | `test/routing.spec.ts` | Intent + `chartDependsOnRetrieval` |
| Unit | `test/references.spec.ts` | Grouping, labels, inline citations |
| Unit | `test/ranking.spec.ts` | Tokenization, scoring, `fileId` exclusion |
| Unit | `test/chart.tool.spec.ts` | Chart discriminated shape |
| E2E | `test/chat.stream.e2e-spec.ts` | `POST /api/chat` SSE, 400 without `tenantId`; **overrides** `WeaviateService` + `LLM_PROVIDER` so no real Weaviate/API key |

**Commands:** `npm test`, `npm run test:e2e`.

---

## 16. Build Tooling Notes

- **`tsconfig.build.json`** sets **`tsBuildInfoFile`** to **`./dist/tsconfig.tsbuildinfo`** so Nest’s **`deleteOutDir`** does not leave a **stale incremental cache** that prevents emitting `dist/main.js` (see README troubleshooting).
- **`.gitignore`**: includes `dist/`, `*.tsbuildinfo`, `node_modules/`, `.env`.

---

## 17. Design Tradeoffs (Documented)

1. **Retrieval**: Keyword ranking over `fetchObjects`, not vector similarity — accurate for the current schema and avoids mislabeling as “semantic search.”
2. **Routing**: Regex-based; LLM is **not** used for routing in this codebase, only for final answer streaming.
3. **Chart**: Fixed mock config; combined flows still describe the chart as mock in the prompt.
4. **Sequential vs parallel RAG+chart**: Both paths populate the same **`data`** array; ordering differs (parallel uses `Promise.all` for RAG async + chart).
5. **Weaviate availability**: App **blocks startup** until Weaviate connects (with retries) — appropriate for a demo that always expects a local DB.

---

## 18. Extension Points

- **New LLM backend**: implement **`LlmProvider`**, register in **`provider.factory.ts`** / **`LlmModule`**.
- **True vector RAG**: change collection schema/vectorizer and **`RagAgentService`** to use nearVector/hybrid queries; keep README honest about behavior.
- **Additional tools**: new nodes or branches in **`delegating.graph.ts`**, extend **`AgentData`** union in **`agent.types.ts`**.

---

*This reference matches the repository layout and behavior at the time of writing. For command-line copy-paste examples, see [README.md](../README.md).*
