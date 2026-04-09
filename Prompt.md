Build the complete project in this repository.

Goal:
Create a runnable Node.js + TypeScript + NestJS backend demo with:
- Dockerized Weaviate
- a multi-tenant schema
- seeded fictional data
- a LangGraph-based delegating agent
- a mocked Chart.js tool
- a Weaviate-backed RAG agent
- a streamed chat API that always emits payloads in this shape:
  { "answer": string, "data": object[] }

Use these defaults unless the repository already has strong conventions:
- TypeScript
- Node.js 20+
- NestJS
- npm
- DTOs + ValidationPipe
- @nestjs/config
- Jest + Supertest
- POST /api/chat with manual chunked streaming
- current maintained package APIs only
- no frontend

Use these package families:
- @nestjs/common
- @nestjs/core
- @nestjs/platform-express
- @nestjs/config
- class-validator
- class-transformer
- weaviate-client
- langchain
- @langchain/core
- @langchain/langgraph
- @langchain/google
- jest
- supertest

You may add small supporting packages only when they clearly improve the implementation.
Do not use deprecated examples or obsolete package APIs.

Important alignment notes:
- The job description explicitly prefers NestJS + TypeScript, so use NestJS rather than a plain Express app.
- Angular is only a bonus, so do not build a frontend.
- Keep the scope backend-only and assessment-focused.

High-level implementation requirements

1) Weaviate setup
- Add docker-compose.yml for local Weaviate.
- Add startup readiness check / retry logic before schema initialization or seeding.
- Use a collection named AgentKnowledge.
- Enable multi-tenancy.
- Create a tenant named tenant-demo.
- Create a schema with these fields:
  - fileId: metadata only, not vectorized, not searchable
  - question: text
  - answer: text
  - pageNumber: textArray
- If supported by the client/schema config, also disable filterability for fileId.
- Seed at least 3 fictional entries into tenant-demo.
- At least one seed entry should include numeric values in the answer so a combined chart + RAG example feels plausible.
- Do not manually provide vectors for the seeded entries.
- Choose a collection/vector configuration that allows this.
- If semantic/vector retrieval is not available in your chosen local setup, the app must still work via fetchObjects fallback retrieval.

2) Delegating agent architecture
Implement a LangGraph-based delegating agent with explicit typed state.

Use nodes similar to:
- classifyIntent
- directAnswer
- runRagAgent
- runChartTool
- composeFinalAnswer

Routing behavior:
- direct-only for greetings/meta/simple questions
- chart-only for obvious visualization requests
- rag-only for knowledge-base questions
- rag + chart when the user asks for both
- when both are needed:
  - run in parallel if independent
  - run sequentially if chart creation depends on retrieved content

Make routing deterministic-first:
- use lightweight rules/keywords for obvious cases
- use LLM help only for ambiguous routing or answer synthesis

3) Chart.js tool
- Implement a mocked Chart.js tool.
- It should return a valid Chart.js config object.
- A fixed bar chart config is acceptable.
- Do not render a chart image.
- Return JSON config only.

4) RAG agent
Implement a RAG agent that queries Weaviate and returns:
- synthesized answer text
- raw supporting records
- grouped reference objects

Preferred retrieval order:
a) use semantic/hybrid retrieval if your chosen Weaviate configuration actually supports it
b) otherwise use query.fetchObjects or collection iteration and perform lightweight in-process ranking

Fallback ranking requirements:
- tokenize lowercased query text
- score overlap against question and answer fields
- prefer exact phrase hits and repeated term hits
- keep this logic simple, explicit, and testable
- do not falsely describe fallback ranking as semantic search

Important:
- fileId is never used for retrieval or matching
- fileId is only returned from matched objects as metadata for references/citations

5) Reference and citation behavior
Group references by fileId.
Merge unique page numbers for the same fileId.
Assign sourceNumber by first appearance order in the returned reference data array.

In the answer text, cite sources in this style:
- 1- Page 3
- 1- Pages 3, 4
- 2- Page 7

Also return structured reference objects in data.

Use a discriminated union similar to:

type AgentData =
  | {
      type: "rag_reference";
      sourceNumber: number;
      fileId: string;
      pageNumbers: string[];
      citationLabel: string;
      question: string;
      answer: string;
    }
  | {
      type: "chartjs";
      chartId: string;
      config: Record<string, unknown>;
    };

type StreamPayload = {
  answer: string;
  data: AgentData[];
};

6) Streaming API in NestJS
Expose at minimum:
- GET /health
- POST /api/chat

POST /api/chat input:
{
  "query": "string",
  "tenantId": "tenant-demo"
}

Implementation requirements:
- Use a DTO class for validation
- tenantId is required
- if tenantId is missing, return 400
- Use a global ValidationPipe
- Keep the route as POST /api/chat

Streaming requirements:
- Do not switch to GET just to use @Sse()
- Implement manual chunked streaming in the controller with @Res()
- Prefer SSE-style chunks using content-type text/event-stream
- each streamed data payload must be valid JSON matching:
  { "answer": "accumulated answer text so far", "data": [] }
- stream multiple payloads as the answer grows
- as soon as chart/reference data is known, include it in data
- keep sending the full current data array in subsequent events
- final event must contain the complete answer and complete data array
- make the endpoint easy to test with curl -N

7) NestJS structure
Create a clean structure similar to this:

src/
  main.ts
  app.module.ts
  common/
    config/
      env.validation.ts
  health/
    health.module.ts
    health.controller.ts
  chat/
    chat.module.ts
    chat.controller.ts
    chat.service.ts
    dto/
      chat.dto.ts
  agents/
    delegating/
      delegating.graph.ts
      routing.ts
    rag/
      rag.agent.ts
      ranking.ts
      references.ts
  tools/
    chart/
      chart.tool.ts
  db/
    weaviate/
      weaviate.module.ts
      weaviate.service.ts
      schema.service.ts
      seed.service.ts
  llm/
    llm.module.ts
    provider.factory.ts
    gemini.provider.ts
    mock.provider.ts
  types/
    agent.types.ts

scripts/
  init-weaviate.ts
  seed-weaviate.ts

test/
  routing.spec.ts
  references.spec.ts
  chart.tool.spec.ts
  ranking.spec.ts
  chat.stream.e2e-spec.ts

Also create:
- docker-compose.yml
- .env.example
- README.md
- package.json
- tsconfig.json
- nest-cli.json if needed
- jest config if needed

You may adjust the exact folders if the repo already has a better Nest structure, but keep it clearly modular.

8) LLM provider behavior
- Use LangChain abstraction for LLM calls.
- Implement Gemini support using GOOGLE_API_KEY.
- Keep model choice env-driven, not hardcoded.
- Put model creation behind a provider factory so a local provider can be added later.
- Optional: implement a local OpenAI-compatible or Ollama-style provider only if it is quick and clean.
- Do not let optional local-provider work block the project.
- For tests, always use a mocked provider.
- If no real provider is configured at runtime, degrade gracefully with deterministic template responses and clear messaging.

9) Validation and robustness
- Use Nest DTO validation, not Zod, unless the repo already requires Zod.
- Use @nestjs/config for env loading.
- Add robust error handling and readable error messages.
- Keep controllers thin.
- Keep business logic in services/agents/tools/utils.
- Use explicit TypeScript types throughout.
- No TODOs, no pseudocode, no dead files.

10) Scripts
Add npm scripts for at least:
- start:dev
- build
- start:prod
- test
- test:e2e
- db:init
- db:seed

You may also add helpful compose scripts if useful.

11) README
Write a practical README that includes:
- project overview
- architecture summary
- why NestJS was chosen for this implementation
- environment variables
- how to start Weaviate
- how to initialize schema and seed data
- how to run the dev server
- example curl requests
- example streamed response
- assumptions and tradeoffs
- clear note on whether retrieval is semantic/hybrid or fetchObjects fallback in the current setup

12) Tests
Add:
- unit tests for routing logic
- unit tests for reference grouping and citation formatting
- unit tests for chart tool output shape
- unit tests for fallback retrieval ranking
- one integration or e2e test for the streaming endpoint using mocked LLM behavior

Execution instructions
- First inspect the repository and reuse any existing useful structure.
- Then implement the full solution end to end.
- Run tests and a production build.
- Fix issues until the repo is in a runnable state.
- Do not stop at scaffolding; finish the implementation.

At the end, give me:
1. a concise summary of what you built
2. the final file tree
3. exact commands to run locally
4. any assumptions you made