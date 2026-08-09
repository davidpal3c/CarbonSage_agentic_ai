# CarbonSage initial Product Roadmap

## Decision summary

CarbonSage is the public identity of the project formerly presented as
NZeroESG. Historical directory names, service names, environment variables,
and deployed URLs remain unchanged until a separate compatibility-safe
migration is justified.

The project remains a lean modular monolith, not a GraphQL or microservice
migration.

The product will demonstrate one defensible workflow:

> A procurement or logistics user uploads shipment data and supplier evidence,
> receives traceable freight-emissions and supplier analysis, compares
> alternatives, and exports a decision-ready report.

The agent may retrieve, orchestrate, explain, and navigate the workflow, but
deterministic code owns calculations, filtering, ranking inputs, citations,
authorization, and report data.

## Trusted baseline objective — complete

Turn the original prototype into a lean, publicly demoable
Scope 3 freight and supplier-evidence workflow that stays maintainable by one
human and costs no more than $30 USD per month beyond existing ChatGPT/Codex
access.

The objective is complete when a new demo user can:

1. Enter an isolated, expiring demo workspace.
2. Upload a supported shipment CSV.
3. Upload at least one real text-based supplier or compliance document.
4. See deterministic emissions calculations with factor sources and
   assumptions.
5. Search and compare suppliers using structured attributes and cited document
   evidence.
6. View useful cards and charts.
7. Export a decision report.
8. Complete the workflow on the public deployment while automated smoke and
   end-to-end checks pass.

## Current checkpoint — August 6, 2026

The public demo finish line is now operational. Render serves the rebuilt
FastAPI application with Neon PostgreSQL, the optional assistant is disabled,
and Vercel serves the rebuilt client from `main`.

The deployment correction is recorded in commits `3d14052` and `e20c476`:

- Vercel's production build uses `next build --webpack` to produce the tracing
  artifact expected by the Vercel build hook.
- `/login` returns HTTP 200 on the public client.
- Render `/health` and `/chat/health` return healthy production responses.
- The exact Vercel-origin CORS preflight passes, while assistant POST requests
  return `503` when the feature is disabled.
- The public Playwright suite passes the five-minute workflow, report export,
  workspace isolation, keyboard entry, and narrow-viewport checks.

The next work should be hardening and measured product improvements, not a
return to the abandoned GraphQL or embedder branches. ChromaDB, the standalone
vector database used by the former retrieval prototype, is replaced by
pgvector in the existing PostgreSQL deployment.

## CarbonSage initial objective

> An embeddable ESG decision agent demonstrating hybrid RAG, semantic
> retrieval, typed tool orchestration, cited responses, and interactive data visualizations.

The objective is to prove practical AI engineering inside a believable
vertical product, not to build a full carbon-accounting SaaS. The dashboard is
a bounded control plane for workspace artifacts, connector configuration,
agent testing, and embed setup. The primary product value is the authenticated
agent that can be embedded into an existing JavaScript application.

The new objective is complete when a reviewer can:

1. Manage a small set of workspace artifacts with provenance and isolation.
2. Compare lexical, semantic, and hybrid retrieval against a checked-in
   evaluation set.
3. Ask a workspace-scoped question that retrieves cited evidence and invokes
   deterministic typed tools.
4. Receive a validated response containing text, metrics, tables, charts,
   citations, warnings, and safe suggested actions.
5. Test the same agent and renderer in the dashboard control plane.
6. Embed the agent into a vanilla JavaScript host with short-lived scoped
   authentication and exact-origin enforcement.
7. Import one explicitly selected Google Drive file through the same bounded
   artifact-ingestion pipeline.
8. Complete the deployed workflow while the original five-minute demo and its
   automated gates remain green.

## Primary demo journey

The workspace demo should take roughly five minutes:

1. Open the site and choose **Enter demo workspace**.
2. Upload a sample or local shipment CSV.
3. Review validation errors and the normalized shipment table.
4. See baseline totals, mode breakdown, hotspots, and data-quality warnings.
5. Upload a supplier sustainability or certification PDF.
6. Open supplier cards showing structured facts and document citations.
7. Compare a baseline shipment with one or more lower-emission scenarios.
8. Export or print a report containing inputs, methodology, evidence, results,
   and caveats.

The demo must still work when the optional LLM feature is disabled.

## Trusted baseline scope decisions

| Candidate                    | Decision for the prototype                                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login` and authentication  | Build a clearly labelled demo-access flow using a server-issued, signed session and isolated expiring workspace. Do not build production identity management yet.                                          |
| Functional portal            | Build one focused workspace dashboard: Overview, Shipments, Suppliers/Evidence, Scenarios, and Report.                                                                                                     |
| CSV upload                   | Required. Support one documented schema, downloadable template, row validation, and a conservative row limit.                                                                                              |
| File/document upload         | Required. Start with text-based PDF and optionally DOCX/TXT. Do not add OCR or scanned-document support.                                                                                                   |
| Reports                      | Required. Build a printable HTML report and CSV export first; avoid a separate report service.                                                                                                             |
| Charts/Recharts              | Include a small set of decision-useful charts: emissions by mode, top shipment hotspots, and scenario comparison.                                                                                          |
| Supplier cards and metadata  | Required. Show source status, certifications, region, transport modes, evidence links, data freshness, and missing fields.                                                                                 |
| Quick replies                | Include only after the core workflow works. Quick replies should trigger explicit product actions, not decorative prompts.                                                                                 |
| Confidence/source/time       | Always show sources and processing time. Replace uncalibrated “confidence” with evidence completeness and data-quality status.                                                                             |
| Memory isolation             | Required. Remove process-global user memory. Store only workspace-scoped conversation/context needed for the demo and expire it.                                                                           |
| Calculation correctness      | First implementation milestone and a release blocker.                                                                                                                                                      |
| Supplier/RAG                 | Use structured supplier records plus cited document retrieval. Keep PostgreSQL full-text search and implement pgvector semantic retrieval; evaluation tunes deterministic hybrid ranking and query routing.           |
| Google Drive                 | Not part of the initial public finish line. It may be used to source test documents during development. A later read-only “import selected file” experiment is acceptable after local ingestion is stable. |
| GraphQL/NestJS/microservices | Explicitly out of scope.                                                                                                                                                                                   |
| Billing                      | Out of scope. Protect costs with quotas, rate limits, retention limits, and a demo access gate.                                                                                                            |

## Trusted baseline architecture

```text
Vercel
└── Next.js application
    ├── marketing page
    ├── demo access
    └── authenticated workspace UI
             │
             ▼
Render
└── FastAPI modular monolith
    ├── workspace/session module
    ├── ingestion module
    ├── emissions domain
    ├── supplier/evidence module
    ├── scenario/report module
    └── optional assistant adapter
             │
             ▼
PostgreSQL
├── workspaces and quotas
├── shipments and calculation runs
├── suppliers and structured attributes
├── documents, chunks, and citations
└── scenarios and report snapshots
```

No Redis, message broker, dedicated embedder, former ChromaDB service, MongoDB, GraphQL
gateway, or auth microservice is required for the prototype.

For initial document retrieval:

- extract text during a bounded upload request;
- store normalized text chunks and document metadata;
- use PostgreSQL full-text search and structured filters;
- retain the original file only temporarily unless a later requirement proves
  it is necessary;
- keep a retrieval interface that supports the required pgvector semantic path
  and deterministic hybrid evaluation.

## Cost and usage envelope

The total recurring infrastructure target is at most $30 USD/month.

Preferred shape:

- Vercel frontend: free tier.
- One Render web service for FastAPI.
- One small managed PostgreSQL database, preferably on the same provider.
- No always-on embedding service.
- No paid object storage for the initial bounded demo.
- No mandatory paid LLM API.

Public demo limits:

- Maximum 500 shipment rows per CSV.
- Maximum 3 uploaded evidence documents per workspace.
- Maximum 10 MB per file.
- Text-based documents only.
- Maximum 10 analysis/scenario runs per workspace per day.
- Maximum 3 optional assistant requests per workspace per day when enabled.
- Workspace and extracted document retention of 24 hours by default.
- Hard server-side timeouts and upload limits.

If the selected Render plan and database cannot stay under the ceiling, the
deployment design must be simplified before adding features.

## Delivery phases

### Phase 0 — Establish a trustworthy baseline

Deliverables:

- [x] Remove abandoned migration artifacts and zero-byte placeholders.
- [x] Rotate exposed deploy hooks and audit secrets.
- [x] Reduce and pin dependencies.
- [x] Make local startup reproducible from documented commands.
- [x] Define environment variables with checked-in example files.
- [x] Add linting, formatting, type checking, and a minimal CI workflow.
- [x] Replace stale README claims with an honest implemented/roadmap split.
- [x] Align architecture, retrieval, and assistant messaging with the rebuild.

Deployment evidence:

- On August 5–6, 2026, the Render API key was rotated, historical deploy-hook
  references were disabled, and the rebuilt API was deployed with the Neon
  `DATABASE_URL` and exact Vercel-origin CORS configuration.
- The old embedder-based service is no longer the public deployment path.
- The repository-history pattern audit found secret-shaped matches only in the
  historical `.github/workflows/deploy.yml`; no active credential file or key
  pattern was identified.

Verification:

- A clean clone starts with one documented workflow.
- CI runs without real provider credentials.
- Secret scanning finds no active credentials.
- Frontend type check and backend test collection pass.

Verified baseline evidence:

- Commit `8b6d324` passed the GitHub Actions `repository`, `backend`, and
  `frontend` jobs on June 19, 2026, including a credential-free clean install,
  backend tests, frontend production build, and production dependency audit.
- A clean local clone of the same baseline built and started through Docker
  Compose without local environment override files; frontend, dashboard, and
  backend health requests returned successfully.
- Commit `0b72100` passed GitHub Actions run `31031689176` on August 5, 2026;
  the `repository`, `backend`, and `frontend` jobs all succeeded. The frontend
  production dependency audit reported zero vulnerabilities after the audited
  Axios, Next.js, PostCSS, and Sharp upgrades.

Exit gate:

> A contributor can clone, configure, run, and test the baseline without
> reverse-engineering old migration work.

### Phase 1 — Build the deterministic calculation core

Deliverables:

- Create framework-independent unit, distance, factor, and emissions modules.
- Define supported freight modes and normalized units.
- Version factor records with source, geography, year, and applicability.
- Separate route distance from straight-line fallback distance.
- Return a stable calculation result schema with warnings and provenance.
- Fix cache identity or avoid caching until correctness is proven.
- Build fixture-based tests for conversions, factors, fallbacks, repeated
  calculations, and comparison ordering.

Initial implementation evidence:

- Commit `8f71073` adds the framework-independent `domain/emissions` package
  with canonical modes, unit normalization, versioned factor records, route
  versus straight-line distance provenance, stable result serialization, and
  deterministic comparison ordering.
- The backend suite now has 27 passing tests, including golden formulas,
  invalid inputs, factor metadata, fallback warnings, repeated calculations,
  and unit-identity collision coverage.
- Commit `a70bdf0` exposes typed `/emissions/calculate` and
  `/emissions/compare` endpoints that return the same provenance-rich schema
  without invoking the optional assistant.
- The factor schedule is explicitly illustrative and carries a warning to
  replace it with an authoritative licensed source before public carbon
  accounting use.

Verification:

- No calculation unit test calls a network.
- Golden examples reproduce expected formulas and units.
- Every displayed result includes factor source and assumptions.
- Repeated calculations are identical and cannot collide across units.

Exit gate:

> The calculator can be trusted and demonstrated without an LLM or external
> emissions API.

Exit-gate evidence:

- Commit `072b61d` passed GitHub Actions run `31032999153` on August 5, 2026;
  the `repository`, `backend`, and `frontend` jobs all succeeded.
- The deterministic API contract tests demonstrate calculation and comparison
  without provider credentials, including factor provenance, assumptions, and
  straight-line distance warnings.

### Phase 2 — Add isolated demo workspaces and the portal

Deliverables:

- Create `/login` as a demo-access page.
- Issue a signed, HTTP-only session tied to one expiring workspace.
- Enforce workspace ownership in every data query.
- Build the portal shell and navigation.
- Add quota and retention records.
- Remove global LangChain memory and global user-specific caches.

Initial implementation evidence:

- The signed session module under `domain/workspaces` issues a unique
  workspace id, expiry, retention policy, and bounded quota records in an
  HMAC-protected claim. It has no process-global conversation memory or
  user-specific cache.
- `POST /demo/session`, `GET /demo/session`, and `DELETE /demo/session` manage
  the HTTP-only session cookie. `/emissions/*` now requires the workspace
  dependency, so direct calls without a valid session fail with `401`.
- The Next.js `/login` page creates a demo session and `/dashboard` verifies the
  cookie before rendering the portal navigation and current quota/retention
  claims.
- Backend tests cover signature tampering, expiry, unique workspace sessions,
  logout, direct API rejection, and two-client isolation. Frontend typecheck,
  lint, formatting, and the Webpack production build pass.
- The `persistence` package adds a checked-in PostgreSQL migration for
  workspace, quota, retention, and revocation records. The repository applies
  migrations idempotently, atomically increments daily analysis quotas, purges
  expired workspaces, and rejects revoked sessions. The CI backend job runs
  against a disposable PostgreSQL service; the full suite passes locally with
  both the development fallback and a temporary PostgreSQL server.
- Commit `3fb8b49` passed GitHub Actions run `31034311577` on August 5, 2026;
  the `repository`, `backend`, and `frontend` jobs all succeeded.
- Commit `93e2c17` passed GitHub Actions run `31035536633` with the disposable
  PostgreSQL backend service; all three jobs succeeded.

Scope boundary for this slice:

- The in-memory adapter is only a native-development fallback. The public
  deployment path requires `DATABASE_URL` and the PostgreSQL adapter.
- Browser-level isolation against a running frontend/API pair and the public
  deployment smoke gate pass in the local and public Playwright suites.

Verification:

- Two browser sessions cannot read or mutate each other's records.
- Expired sessions are rejected and expired workspace data is removable.
- Direct API calls without a valid workspace session fail safely.

Exit gate:

> A public visitor can enter a controlled demo workspace with verified data
> isolation.

### Phase 3 — Implement shipment CSV ingestion

Deliverables:

- Publish a CSV template and schema documentation.
- Validate file size, MIME type, headers, row count, units, modes, locations,
  weights, and distances.
- Provide row-level errors without discarding valid rows.
- Normalize accepted rows and calculate a baseline analysis.
- Show a shipment table, totals, mode breakdown, hotspots, and quality warnings.

Initial implementation evidence:

- `domain/shipments` implements bounded UTF-8 CSV parsing, schema/header checks,
  MIME and filename checks, row limits, finite positive numeric validation,
  unit/mode normalization, hostile-content rejection, and row-level errors.
- `POST /shipments/upload` stores accepted normalized rows under the active
  workspace and returns deterministic totals, mode breakdowns, hotspots, factor
  metadata, assumptions, and warnings. `GET /shipments` reads only that
  workspace's rows.
- The protected portal now provides the CSV upload, normalized table, totals,
  mode breakdown, hotspots, and data-quality issue display. The template and
  schema are documented in `docs/shipment-csv.md`.
- Backend fixtures cover valid, partial, invalid, oversized, hostile, and
  workspace-isolated uploads; both the development fallback and PostgreSQL
  repository suites pass.
- Commit `ced95a1` passed GitHub Actions run `31036783647`; the `repository`,
  `backend`, and `frontend` jobs all succeeded.

Verification:

- Fixture tests cover valid, partially valid, invalid, oversized, and hostile
  CSV inputs.
- The sample file completes ingestion and analysis within the public timeout.
- No raw upload content appears in logs.

Exit gate:

> A user can upload a realistic shipment file and understand both its emissions
> result and its data-quality limitations.

### Phase 4 — Implement supplier evidence ingestion and retrieval

Deliverables:

- Model suppliers separately from evidence documents.
- Upload text-based PDF and optionally DOCX/TXT.
- Extract bounded text with page/section location metadata.
- Store chunks, source metadata, extraction status, and timestamps.
- Search with structured supplier filters plus PostgreSQL full-text retrieval.
- Render supplier cards and evidence excerpts with citations.
- Rank only on explicit, visible criteria; preserve missing values.

Initial implementation evidence:

- `domain/evidence` accepts bounded UTF-8 TXT and text-based PDF uploads,
  extracts normalized chunks with page numbers where available, rejects
  encrypted/empty/oversized content, and normalizes structured supplier fields.
- Migration `003_evidence.sql` stores workspace-scoped suppliers, documents,
  chunks, hashes, metadata, and a PostgreSQL `tsvector` full-text index.
- `POST /evidence/upload`, `GET /suppliers`, and `GET /evidence/search` expose
  structured supplier cards and cited excerpts containing filename, document
  hash, chunk index, and PDF page location when available.
- The protected portal now supports evidence upload, missing-field display,
  supplier cards, and citation search. Tests cover TXT/PDF extraction,
  citation locations, retrieval, isolation, and the three-document quota.
- Commit `c2bee8b` passed GitHub Actions run `31037902952`; the `repository`,
  `backend`, and `frontend` jobs all succeeded with the disposable PostgreSQL
  service.

Verification:

- Ingestion fixtures produce stable chunks and recoverable citations.
- Search evaluation contains representative questions and expected evidence.
- Every supplier claim shown in the UI is marked as structured, document-backed,
  user-provided, or missing.
- The system never silently treats the old synthetic supplier JSON as real.

Exit gate:

> A user can upload real supplier evidence and retrieve the exact supporting
> text behind a displayed claim.

### Phase 5 — Add scenarios, visualizations, and reports

Deliverables:

- Compare baseline and alternative freight modes or supplier choices.
- Add three focused charts with accessible table equivalents.
- Add explicit quick actions for common scenario operations.
- Build a report preview containing methodology, inputs, sources, results,
  warnings, and scenario deltas.
- Support print-to-PDF and CSV export.
- Show processing time and evidence completeness.

Initial implementation evidence:

- `domain/scenarios` compares every persisted shipment against a selected
  alternative mode using the same versioned calculation factors as baseline
  analysis, returning shipment-level deltas and methodology metadata.
- `POST /scenarios/compare`, `GET /reports/preview`, and
  `GET /reports/export.csv` are workspace-authenticated. CSV cells are guarded
  against spreadsheet formula injection, and report data is rebuilt from the
  current workspace state.
- The protected portal now exposes scenario quick actions, accessible
  shipment-level result tables, comparison bars, print-to-PDF styling, and
  authenticated CSV export. Navigation labels now reflect the shipped
  shipment, evidence, scenario, and report sections.
- The backend suite has 59 passing tests locally and against disposable
  PostgreSQL, including scenario reconciliation, report parity, session
  rejection, and workspace persistence checks. Frontend typecheck, lint,
  formatting, and the Webpack production build pass locally.
- Commit `b1cc7f1` passed GitHub Actions run `31039714610`; the repository,
  backend, and frontend jobs all succeeded.
- A Playwright smoke suite now exercises the local/CI five-minute journey,
  including session creation, shipment analysis, supplier citation retrieval,
  scenario/report actions, print styling, and two-workspace isolation. It is
  wired as a separate CI job against disposable PostgreSQL.
- A non-secret `render.yaml` Blueprint defines the public API service on
  production `main` with CI-gated auto-deploy and a generated session secret.
  `DATABASE_URL` is deliberately a dashboard-supplied secret for a Neon
  PostgreSQL project rather than a Render database resource. This keeps the
  database at the current Neon Free-plan price of $0 for the bounded demo.
- Commit `b5dc94f` passed GitHub Actions run `31042422923`; repository,
  backend, frontend, and PostgreSQL-backed browser jobs all succeeded.
- Commit `37007c7` passed GitHub Actions run `31045133417`; repository,
  backend, frontend, and PostgreSQL-backed browser jobs all succeeded after
  bounded evidence reads, security headers, deterministic logout navigation,
  and the Neon deployment handoff were added.

Verification:

- [x] Scenario totals reconcile with the calculation engine.
- [x] Charts and report values come from the same typed result payload.
- [x] Exported data matches the displayed workspace state.
- [ ] Keyboard and responsive checks pass for the primary workflow.

The remaining Phase 5 browser gate is now complete. The local and public
Chromium suites cover the full interaction, including keyboard navigation,
narrow-viewport layout, workspace isolation, print styling, and CSV download.
The previous Vercel and Render failures were historical deployment evidence;
the current public services use the rebuilt client and API.

Exit gate:

> The prototype produces a decision artifact suitable for a demo
> walkthrough, not merely a chatbot transcript.

### Phase 6 — Optional assistant, deployment, and demo hardening

Deliverables:

- Add an optional assistant adapter over stable application commands.
- Constrain the assistant to workspace-scoped retrieval and typed tools.
- Make the assistant unavailable gracefully when no provider is configured.
- Add rate limits, timeouts, sanitized structured logs, and error tracking
  appropriate to the budget.
- Add deployed health checks and one end-to-end primary-journey test.
- Prepare sample CSV and evidence documents with clear licensing/provenance.
- Rewrite the public site around what the product actually demonstrates.

Verification:

- The primary journey passes with the assistant disabled.
- When enabled, the assistant cannot access another workspace.
- The deployment survives malformed uploads and provider failures.
- Frontend, API, database, ingestion, and report smoke checks pass online.
- Monthly service configuration remains within the cost ceiling.

Current exit-gate evidence:

- The assistant is disabled by default and fails closed with a `503` response
  when called in production.
- Render health, security headers, exact-origin CORS, and Neon-backed startup
  pass against the public service.
- Vercel serves `/login` from the current `main` deployment, and the public
  browser suite passes the primary journey, report export, isolation,
  keyboard, and narrow-viewport checks.
- The deployment shape remains Vercel plus one Render API and one Neon Free
  PostgreSQL database, with no mandatory paid LLM or embedding service.

Exit gate:

> A reviewer can open the public site, complete the five-minute demo, inspect
> sources and assumptions, export the result, and understand the project's
> technical decisions without developer intervention.

## CarbonSage initial track

The completed six-phase demo remains a release baseline. The following phases
form a new track and must not rewrite or weaken the evidence above.

### Phase 7 — Product contracts and artifact foundation

Deliverables:

- Adopt CarbonSage as the public product identity and record the compatibility
  boundary for historical deployment identifiers.
- Define a workspace artifact catalog for shipment datasets, evidence
  documents, and report snapshots.
- Add create/import, list, detail, rename, and soft-delete operations with
  source provenance and workspace isolation.
- Link existing normalized shipment and evidence records to their source
  artifacts without replacing their domain schemas with generic JSON.
- Define a common internal workspace principal for the existing dashboard
  session and future embed credentials.

Verification:

- Existing upload and report workflows continue to pass.
- Two workspaces cannot read, mutate, or infer each other's artifacts.
- Deleting an artifact has deterministic, tested behavior for derived records.
- Raw file retention remains bounded and documented.

Exit gate:

> The control plane manages a small, coherent artifact catalog without
> becoming an organization-administration SaaS.

### Phase 8 — Evaluated hybrid retrieval

Deliverables:

- Keep PostgreSQL full-text search as the credential-free lexical baseline.
- Add a provider-neutral embedding adapter and versioned embedding metadata.
- Provision pgvector through checked-in migrations in the existing PostgreSQL
  deployment; do not add a dedicated vector database.
- Implement lexical-only, semantic-only, and deterministic hybrid retrieval.
- Check in approximately 25–40 representative questions with expected
  artifacts or chunks.
- Report recall at k, reciprocal-rank position, citation coverage,
  answer-support rate, unsupported-answer rate, latency, and provider cost.

Verification:

- Every candidate is filtered by workspace before it can be returned.
- Every retrieved passage preserves artifact, document, page/section, and
  chunk identity.
- CI verifies lexical and vector storage/query behavior with deterministic
  fixture embeddings and no paid provider credential.
- Evaluation tunes fusion weights and query routing while the pgvector-backed
  semantic capability remains available.

Implementation evidence (completed 2026-08-08):

- Migration `004_pgvector_retrieval.sql` enables pgvector and stores
  workspace-scoped 1,536-dimensional vectors with provider, model, dimension,
  content-hash, and timestamp metadata.
- The provider-neutral adapter supports configured OpenAI-compatible embedding
  endpoints while deterministic fixtures keep CI credential-free.
- Evidence upload indexes bounded chunks when configured. Semantic and hybrid
  requests lazily backfill pre-existing workspace evidence after validating
  chunk hashes.
- `GET /evidence/search` exposes lexical, semantic, and hybrid modes. Exact
  cosine search preserves the workspace predicate and deterministic
  reciprocal-rank fusion records both source ranks.
- Local Compose and both PostgreSQL CI jobs use the pinned pgvector
  0.8.6/PostgreSQL 16 image.
- The checked-in 25-case evaluation set covers exact terms, paraphrases,
  structured context, dates, evidence limitations, and unsupported questions.
  A seven-supplier synthetic corpus makes every expected evidence identifier
  reproducible. The isolated database-backed capture runner and grader report
  recall at k, mean reciprocal rank, citation coverage, answer support,
  unsupported answers, latency, and explicitly supplied provider cost.
- Local credential-free tests pass, and the full backend suite passes against
  a disposable pgvector/PostgreSQL database. Dev CI
  [run 31209187231](https://github.com/davidpal3c/NZeroESG_Scope3/actions/runs/31209187231)
  passed repository, backend, frontend, and browser jobs on 2026-08-07.
- The reproducible PostgreSQL lexical baseline records recall@5 `1.0`, mean
  reciprocal rank `0.977273`, and citation coverage `1.0`; answer support
  remains explicitly unmeasured until a grounded agent run supplies answers.
- Provider-backed captures with 1,536-dimensional
  `openai/text-embedding-3-small` embeddings through OpenRouter are checked in
  beside the lexical baseline. Semantic retrieval measured recall@5
  `0.954545`, mean reciprocal rank `0.901515`, and citation coverage `1.0`.
  Hybrid retrieval measured recall@5 `1.0`, mean reciprocal rank `0.969697`,
  and citation coverage `1.0`.
- Semantic-only retrieval missed one expected policy record in the top five;
  deterministic hybrid fusion restored it at rank three. Hybrid therefore
  leads for the future grounded agent when embeddings are healthy, lexical
  remains the low-latency default and failure fallback, and semantic-only mode
  remains available for diagnostics.
- Hybrid matched lexical recall with a slightly lower reciprocal-rank score,
  so the current claim is measured semantic capability and hybrid recall—not
  a blanket quality improvement over lexical search. Answer support remains a
  Phase 9 measurement because these captures did not generate answers.

Exit gate:

> CarbonSage can defend its semantic and hybrid RAG claims with measured
> retrieval evidence rather than architecture alone.

### Phase 9 — Typed agent runtime and structured responses

Deliverables:

- Replace the transitional `/chat` implementation with authenticated,
  workspace-scoped conversation and message resources.
- Remove runtime prompt downloads and check in the versioned agent policy.
- Expose approved typed tools for artifact listing, evidence search, citation
  context, emissions calculations, scenario comparison, data quality, and
  report data.
- Enforce assistant quotas and persist only bounded conversation state,
  validated responses, citations, and concise tool events.
- Define a versioned response envelope with text, metric, table, chart,
  citation, artifact-reference, warning, and action blocks.
- Build one accessible renderer with safe unknown-block fallbacks and table
  equivalents for charts.

Verification:

- The agent cannot access another workspace or bypass deterministic tool
  validation.
- Chart and metric values reconcile with the same typed result used by reports.
- Unsupported claims produce an evidence limitation rather than an invented
  citation.
- Tool activity is observable without exposing private chain-of-thought.
- The primary deterministic workflow remains usable when model and embedding
  providers are disabled.

Exit gate:

> A user receives a cited, interactive decision response built from validated
> retrieval and deterministic tool outputs.

### Phase 10 — Dashboard agent playground

Deliverables:

- Add a control-plane agent-testing surface using the production conversation
  API and shared structured renderer.
- Let a user inspect cited artifacts, evidence completeness, processing time,
  and concise tool activity.
- Replace stale legacy-assistant messaging and clearly report disabled or
  unavailable providers.
- Keep mutations behind server-defined action identifiers and explicit user
  confirmation.

Verification:

- Playground responses are scoped to the active workspace.
- Every structured block has keyboard and narrow-viewport coverage.
- Provider failure does not affect artifact management or deterministic tools.

Exit gate:

> The dashboard is a useful agent control plane and test workspace, not the
> only place where CarbonSage intelligence can be consumed.

### Phase 11 — Authenticated JavaScript embed

Deliverables:

- Add a framework-independent loader that mounts a CarbonSage-hosted iframe.
- Add embed-client configuration with exact allowed origins, scopes, status,
  creation time, and revocation.
- Issue short-lived credentials containing workspace, subject, audience,
  client, origin, scope, expiry, and token-id claims.
- Pass credentials to the iframe in memory through an exact-origin
  `postMessage` handshake, not a persistent URL parameter.
- Keep frame denial for the dashboard and apply a client-specific
  `frame-ancestors` policy only to the embed route.
- Provide a vanilla JavaScript sample host and a small event contract for
  readiness, resize, token refresh, artifact links, actions, and errors.

Verification:

- The embed works with third-party cookies blocked.
- A missing, expired, revoked, wrongly scoped, or wrong-origin credential is
  rejected.
- No permanent API secret appears in browser code, URLs, logs, or Git.
- The sample host receives the same response schema and renderer behavior as
  the dashboard playground.

Exit gate:

> A reviewer can embed the authenticated CarbonSage agent into a plain
> JavaScript application and receive a workspace-grounded interactive answer.

### Phase 12 — One connector and interoperability proof

Deliverables:

- Add a read-only Google Drive selected-file import using the narrowest
  practical authorization scope.
- Import supported files through the existing bounded ingestion and artifact
  pipeline with provider provenance.
- Avoid folder-wide access, background synchronization, and indefinite raw-file
  retention.
- After typed tools and authorization stabilize, optionally expose a small
  read-only MCP adapter for artifact listing, evidence search, citation
  retrieval, calculations, and scenario comparison.
- Evaluate CarbonSage as a Ceiba dogfooding workload only after Ceiba's
  production boundary is reviewed; CarbonSage must remain independently
  deployable.

Verification:

- Users can import only explicitly selected supported files.
- Disconnect and provider failure do not remove already-normalized provenance.
- The optional MCP surface calls the same application services and enforces the
  same workspace and quota boundaries.

Exit gate:

> CarbonSage demonstrates one real external ingestion path and, if justified,
> one reusable agent interoperability surface without duplicating domain logic.

## Deferred product surface

- Dropbox integration before Google Drive proves the connector contract.
- Production identity, SSO, SCIM, organizations, and enterprise RBAC.
- Billing, subscriptions, plans, and marketplace concerns.
- Background connector synchronization and large-document worker queues.
- Framework-specific React, Vue, and Angular SDKs beyond the shared loader.
- Multi-agent orchestration without an evaluated need.
- Additional Scope 3 categories before the freight and supplier slice is
  complete.

## Explicit non-goals

- Production-grade carbon accounting or regulatory filing.
- Automated verification of certification authenticity.
- OCR or scanned-document extraction.
- General-purpose ESG chatbot.
- Autonomous procurement decisions.
- Decorative multi-agent orchestration.
- Unevaluated semantic or vector-search claims.
- Real-time carrier pricing.
- Billing and subscriptions.
- Enterprise RBAC, SSO, SCIM, or audit exports.
- GraphQL federation or service decomposition.

## Goal operating policy

When the next Codex Goal is started, it should use the CarbonSage initial
objective and remain active across implementation turns. Each phase has its own
auditable exit gate, and work should proceed one gate at a time.

Between iterations:

1. Inspect the current phase's evidence.
2. Choose the smallest change that moves its exit gate.
3. Run the narrow relevant checks.
4. Record material scope or architecture decisions in this roadmap.
5. Do not mark the CarbonSage objective complete until the embedded public
   end-to-end finish line passes and the original demo remains green.

If a phase cannot be completed within the cost ceiling or repository boundary,
stop with:

- attempted approaches;
- evidence collected;
- the exact blocker;
- the least-expensive decision that would unblock progress.

## Release checklist

- [x] Public frontend is reachable.
- [x] API and database health checks pass.
- [x] Demo access and workspace isolation pass.
- [x] Sample CSV ingestion passes.
- [x] Real evidence document ingestion passes.
- [x] Calculations expose versioned sources and assumptions.
- [x] Supplier cards expose evidence and missing data.
- [x] Scenario charts reconcile with calculations.
- [x] Report export matches the UI.
- [x] Assistant-off workflow passes.
- [x] End-to-end browser test passes against production.
- [x] Secrets and uploaded content are absent from Git and logs.
- [x] README accurately distinguishes implemented features from future work.
- [x] Monthly deployment configuration is at or below $30 USD.
