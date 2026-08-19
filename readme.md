# 🌱 CarbonSage 
(formerly NZeroESG)

### Evidence-grounded Scope 3 intelligence, wherever decisions happen.

CarbonSage is an embeddable ESG decision agent for freight and supplier
workflows. It brings shipment data, supplier evidence, deterministic emissions
tools, and conversational analysis into one traceable experience.

The initial thesis is deliberately specific:

> An embeddable ESG decision agent demonstrating hybrid RAG, semantic
> retrieval, typed tool orchestration, cited responses, and interactive data visualizations.

The goal is not to build an entire carbon-accounting SaaS. CarbonSage uses just
enough product structure—isolated workspaces, artifact management, an agent
playground, and a secure embed surface—to prove that the AI system works in a
credible application.

## Why this project exists

Procurement and logistics teams often have the information they need, but it is
scattered across shipment files, supplier PDFs, spreadsheets, and existing
operational systems. CarbonSage explores a practical question: can an agent
retrieve the right evidence, invoke trusted calculation tools, explain the
trade-off, and return a decision-ready result without becoming the source of
truth itself?

That means deterministic code still owns calculations, scenario data, source
locations, and report values. The agent is responsible for finding context,
choosing typed tools, and explaining validated results.

## Try the current demo

The trusted deterministic baseline is live at:

<https://n-zero-esg-scope3.vercel.app/>

The intended path is short:

1. Enter an isolated, expiring demo workspace.
2. Upload shipment data, or use
   [`docs/examples/shipments.csv`](docs/examples/shipments.csv).
3. Add supplier or compliance evidence.
4. Review totals, freight modes, hotspots, warnings, and cited supplier facts.
5. Compare a lower-emission scenario and export the report.

The API health endpoint is:

- <https://nzeroesg-api.onrender.com/health>

Production currently follows `main` and presents the deterministic workflow.
The typed agent and control-plane work described below is complete on `dev` and
will move to production only after its usability and release gates pass.

The public workflow does not require an LLM. The typed agent reports itself as
disabled unless a compatible model provider is explicitly configured; artifact
management, retrieval, calculations, scenarios, and reports remain available.

## What works today

- Deterministic freight-emissions calculations with versioned factor
  provenance, assumptions, and distance warnings.
- Signed, expiring demo workspaces with HTTP-only sessions, quotas, retention,
  revocation, and workspace-isolated persistence.
- Shipment CSV ingestion with bounded validation, row-level errors, normalized
  records, mode breakdowns, hotspots, and quality warnings.
- Text and text-based PDF evidence ingestion with structured supplier records,
  recoverable page/chunk citations, and PostgreSQL full-text retrieval.
- Explicit lexical, pgvector semantic, and deterministic hybrid retrieval
  modes with workspace filtering, versioned embedding metadata, and a safe
  lexical fallback when no embedding provider is configured.
- A checked-in 25-case retrieval evaluation: lexical and hybrid both reached
  `1.0` recall@5, while hybrid recovered the one expected result missed by
  semantic-only retrieval.
- A separate approved OpenRouter answer-support baseline over the same
  synthetic set: `1.0` support across 22 answerable cases, `0.0` unsupported
  answers across three abstention cases, and no typed assessment failures. It
  fixes tool selection, so the claim is evidence gating and citation safety—not
  general agent accuracy.
- An authenticated v1 conversation API with bounded workspace state, a
  checked-in policy, seven validated tools, assistant quotas, persisted
  citations, and concise tool events.
- A fail-closed evidence-support gate: retrieved passages are not rendered or
  persisted as supporting citations until a constrained typed assessment
  approves their existing IDs. Related or unsupported evidence returns an
  explicit limitation.
- A shared structured-response renderer for text, metrics, tables, charts,
  citations, artifacts, warnings, and confirmed actions. Charts include exact
  keyboard-accessible table equivalents and unknown blocks degrade safely.
- Scenario comparisons, accessible chart alternatives, printable report
  previews, and authenticated CSV export.
- A workspace artifact catalog for shipment datasets, evidence documents, and
  report snapshots, with provenance, citation identity, rename, bounded
  soft-deletion, and cross-workspace isolation.
- A routed control plane with persistent workspace navigation and standalone
  overview, artifact, shipment, supplier-evidence, scenario, report, and agent
  pages. Every section can be linked to or refreshed directly.
- A dedicated decision-agent testing page using the same workspace-scoped
  conversation API and structured renderer as the control-plane launcher.
- A Vercel client, Render API, Neon PostgreSQL database, and credential-free CI
  and browser checks.

## Upcoming changes:

CarbonSage will build on that baseline in a controlled order:

1. Extend the dedicated agent page with evidence-completeness and concise
   tool-event inspection around its existing conversation history and shared
   renderer.
2. Add a framework-independent JavaScript loader and authenticated iframe.
3. Add one explicit, read-only Google Drive selected-file import.
4. Optionally expose a read-only MCP adapter over the same stable application
   tools.

Dropbox, billing, organization administration, background synchronization,
enterprise RBAC, and a family of framework-specific SDKs are intentionally
deferred for now. One excellent vertical slice is more valuable here than broad SaaS
surface area.

## Architecture

CarbonSage remains a lean modular monolith:

```text
Control plane / dashboard ── workspace session ──┐
JavaScript host ── loader + iframe ── embed token ──┼─→ FastAPI agent runtime
Google Drive ── selected-file import ── artifact ──┘          │
                                                        ├─→ typed tools
                                                        ├─→ hybrid retrieval
                                                        └─→ Neon PostgreSQL
```

No Redis, message broker, dedicated vector database, background worker, or
agent microservice is required. pgvector is the required semantic-search layer
inside the existing PostgreSQL retrieval path, not a new service.

The former NZeroESG retrieval prototype used ChromaDB as its standalone vector
database. CarbonSage retains that history while consolidating lexical records,
embeddings, workspace isolation, and citations in PostgreSQL.

The detailed decisions and delivery gates live in:

- [`docs/demo-roadmap.md`](docs/demo-roadmap.md)
- [`docs/app.architecture.md`](docs/app.architecture.md)
- [`docs/langchain.rag.workflow.md`](docs/langchain.rag.workflow.md)
- [`docs/carbonsage-ecosystem-vision.md`](docs/carbonsage-ecosystem-vision.md)
  records the post-initial-release open/community and commercial possibilities
  without expanding the active roadmap.

## Stack

| Part                      | Role                                                                             |
| ------------------------- | -------------------------------------------------------------------------------- |
| Next.js and React         | Public site, routed control plane, agent workspace, embed UI, and structured renderers |
| FastAPI                   | Sessions, artifacts, retrieval, typed tools, conversations, and reports          |
| Neon PostgreSQL           | Workspace data, evidence, full-text search, and evaluated vector retrieval       |
| LangChain                 | Optional orchestration adapter, not domain logic or source of truth              |
| Vercel                    | Public client deployment from `main`                                             |
| Render                    | FastAPI deployment from the production `main` branch                             |
| Docker and GitHub Actions | Reproducible local setup and automated checks                                    |

## Run locally

You will need Python 3.12.10, Node.js 20.19.0 or newer, npm, and Docker for the
full local stack.

### Docker

```bash
docker compose up --build
```

Then open:

- Frontend: <http://localhost:3000>
- API health: <http://localhost:8000/health>
- API documentation: <http://localhost:8000/docs>

### Native tools

```bash
make setup
make check
```

Run the API and client in separate terminals:

```bash
cd nzeroesg-api
../.venv/bin/uvicorn main:app --reload
```

```bash
cd nzeroesg-client
npm run dev
```

For local environment overrides:

```bash
cp nzeroesg-api/.env.example nzeroesg-api/.env
cp nzeroesg-client/.env.example nzeroesg-client/.env.local
```

The historical directory, service, environment-variable, and public URL names
remain unchanged so the working deployment is not broken by the public rebrand.

## Optional model provider

The typed agent is intentionally fail-closed when no compatible provider is
configured. It can be enabled in `nzeroesg-api/.env`:

```dotenv
ASSISTANT_ENABLED=true
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

OpenRouter is also supported. No provider credential is required for the
deterministic workflow, CI, or the primary public demo.

Semantic and hybrid retrieval can be enabled independently of the assistant:

```dotenv
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

For OpenRouter, use `openrouter` as the provider and its provider-qualified
embedding model identifier. Lexical retrieval remains available without these
settings.

## Quality checks

Backend:

```bash
cd nzeroesg-api
../.venv/bin/ruff check .
../.venv/bin/ruff format --check .
../.venv/bin/pytest
```

Frontend:

```bash
cd nzeroesg-client
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:e2e
```

CarbonSage is still a prototype, but it has a clear standard: AI-generated
guidance should be useful, inspectable, grounded in workspace evidence, and
easy to carry into the software where a decision is already being made.

Built by David P.

## License

See [`LICENSE.md`](LICENSE.md).
