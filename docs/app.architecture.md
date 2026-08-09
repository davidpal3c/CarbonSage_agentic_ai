# CarbonSage Application Architecture

## Initial product decision

CarbonSage is an embeddable ESG decision agent, not a general carbon-accounting
SaaS and not a general-purpose chatbot.

Its initial thesis is:

> An embeddable ESG decision agent demonstrating hybrid RAG, semantic
> retrieval, typed tool orchestration, cited responses, and interactive data
> visualizations.

The already-deployed shipment, evidence, scenario, and report workflow remains
the trusted deterministic baseline. The next track adds enough product surface
to prove the AI system in practice: a workspace artifact catalog, an agent
playground, one secure embed path, and one external file-import integration.

## Architecture decision

CarbonSage remains one lean modular monolith:

```text
Vercel / Next.js
├── demo access
├── control plane
│   ├── artifact catalog
│   ├── connector management
│   ├── agent playground
│   └── embed-client configuration
└── isolated `/embed` experience
        │
        ├── dashboard: signed workspace cookie
        └── embed: short-lived scoped bearer credential
                 │
                 ▼
Render / FastAPI
├── workspace principal and quota boundary
├── artifact and ingestion services
├── hybrid evidence retrieval
├── typed deterministic application tools
├── conversation and structured-response service
└── optional model-provider adapter
                 │
                 ▼
Neon PostgreSQL
├── workspaces, quotas, and retention
├── artifacts and domain records
├── documents, chunks, and citations
├── lexical and evaluated vector indexes
└── conversations and validated response envelopes
```

No Redis, MongoDB, GraphQL gateway, message broker, dedicated vector database,
background worker, or agent microservice is required for the initial finish
line. pgvector is the required semantic-search implementation inside the
existing PostgreSQL evidence repository. Retrieval evaluation determines
fusion, weighting, and query routing; it does not determine whether the vector
capability exists.

## Product surfaces

### Control plane

The dashboard is where a demo workspace manages source material and tests the
agent. Its bounded responsibilities are:

- create, inspect, rename, and delete workspace artifacts;
- upload shipment datasets and supplier evidence;
- import an explicitly selected Google Drive file;
- test the agent against the same workspace context used by an embed;
- create and revoke embed clients with exact allowed origins;
- inspect quotas, evidence completeness, and concise tool activity.

It is not an organization-admin, billing, SSO, or enterprise-RBAC console.

### Agent runtime

The agent runtime accepts an authenticated workspace principal, retrieves only
that workspace's evidence, invokes typed application tools, and returns a
versioned response envelope. It may explain deterministic results but cannot
become the authority for a calculation, citation, supplier fact, or report.

The current `/chat` endpoint is a transitional estimator. The target runtime
will use conversation resources and one common principal abstraction for the
dashboard cookie and embed bearer credential.

### Embedded experience

The first integration is a framework-independent JavaScript loader that mounts
an iframe hosted by CarbonSage. The iframe is the deliberate first choice:

- it isolates CSS, React, charting, and runtime dependencies from the host;
- it works in vanilla JavaScript, React, Vue, Angular, and existing portals;
- it keeps API calls on the CarbonSage frontend origin;
- it provides a small, testable `postMessage` contract for resize, readiness,
  token refresh, artifact links, and action requests.

The parent and iframe must validate exact origins and message shapes. The
dashboard and other application routes retain frame denial; only the embed
route receives a client-specific `frame-ancestors` policy.

The host must not contain a permanent API secret. A trusted host backend issues
or exchanges a short-lived credential with workspace, subject, audience,
client, scope, origin, expiry, and token-id claims. The loader passes it to the
iframe in memory, never as a persistent URL query parameter.

## Artifact boundary

An artifact is a workspace-owned source or generated decision asset. Initial
kinds are:

- shipment dataset;
- supplier evidence document;
- report snapshot.

An artifact records title, kind, status, source type, source reference, media
type, content hash, version, metadata, authorship, timestamps, and soft-deletion
state. Existing shipment rows, suppliers, evidence chunks, calculations, and
scenario results remain normalized domain records linked to their source
artifact. Suppliers remain first-class domain entities rather than untyped
artifact metadata.

Raw uploaded files remain temporary unless a measured requirement changes the
retention policy. The artifact catalog retains provenance and normalized
results, not an unbounded file store.

## Source-of-truth boundaries

Deterministic application code owns:

- input limits, validation, and normalization;
- unit conversion, factors, formulas, calculations, and warnings;
- supplier filters and retrieval constraints;
- source identifiers and citation locations;
- scenario values, chart rows, and report payloads;
- authorization, workspace isolation, quotas, and retention.

The model may:

- interpret a user's question;
- select from approved typed tools;
- summarize validated tool results;
- suggest server-defined next actions;
- explain uncertainty, missing evidence, and data-quality limitations.

The model may not invent factor values, silently rank suppliers, emit arbitrary
executable chart code, create unsupported claims, or perform a mutation without
explicit user confirmation.

## Typed tool boundary

The target tool set is intentionally small:

```text
list_workspace_artifacts
search_supplier_evidence
get_citation_context
calculate_freight_emissions
compare_transport_scenarios
summarize_data_quality
build_decision_report
```

Each tool accepts and returns validated domain schemas. Domain logic must not
depend on FastAPI, LangChain, a model provider, or a future MCP adapter.
LangChain can orchestrate these commands, but it does not own them.

## Structured response protocol

The dashboard and iframe share one renderer over a versioned response envelope:

```json
{
  "schema_version": "1.0",
  "conversation_id": "uuid",
  "message_id": "uuid",
  "summary": "Road freight is the largest source in this workspace.",
  "blocks": [
    {
      "type": "metric",
      "label": "Baseline emissions",
      "value": 12450,
      "unit": "kg CO2e"
    },
    {
      "type": "chart",
      "chart_type": "bar",
      "title": "Emissions by freight mode",
      "rows": [
        { "mode": "truck", "emissions_kg": 7200 },
        { "mode": "ship", "emissions_kg": 3100 }
      ]
    },
    {
      "type": "citation",
      "artifact_id": "uuid",
      "label": "Supplier sustainability report, page 8"
    }
  ],
  "suggested_actions": [],
  "processing_time_ms": 842
}
```

Initial blocks are text, metric, table, chart, citation, artifact reference,
warning, and action. Charts use a constrained declarative schema and always
have an accessible table equivalent. Unknown block types degrade to safe
fallback text. Mutating actions reference server-defined action identifiers
and require confirmation.

## Retrieval architecture

PostgreSQL full-text search remains the lexical baseline. Semantic retrieval is
introduced as an evaluated extension, not an architectural fashion choice:

```text
bounded document ingestion
  → normalized chunks with source locations
  → lexical retrieval with PostgreSQL full-text search
  → semantic retrieval with PostgreSQL vector search
  → deterministic hybrid candidate fusion
  → recoverable citations
  → grounded answer and structured blocks
```

A representative retrieval set compares lexical-only, semantic-only, and
hybrid results. The pgvector schema and query path are implemented regardless
of which mode wins a particular evaluation. CarbonSage should claim semantic
or hybrid improvement only when recall-at-k, citation coverage, and answer
support demonstrate it.

The first pgvector contract stores 1,536-dimensional embeddings separately
from immutable evidence chunks, with provider, model, content hash, and
workspace metadata. Retrieval uses exact cosine distance for the bounded demo
corpus and reciprocal-rank fusion with `k = 60`. Approximate indexing remains a
future scale decision because a shared tenant-filtered HNSW index can trade
away recall before the workspace predicate is applied.

### Former ChromaDB path

The earlier NZeroESG prototype used ChromaDB as a standalone vector database.
CarbonSage replaces that deployment boundary with pgvector so lexical records,
embeddings, workspace ownership, retention, and citation metadata remain in
the same PostgreSQL system. ChromaDB remains documented as architecture
history, not an active dependency.

## Connector boundary

Google Drive is the only connector required for the initial finish line. It
imports explicitly selected, supported files through the same bounded
ingestion pipeline as local uploads and records provider provenance on the
artifact. Broad-drive access, folder sync, background polling, and indefinite
token retention are out of scope.

Dropbox is deferred until the provider-neutral import interface has proved
useful. One connector demonstrates the architecture.

## MCP and Ceiba extension points

After typed tools and workspace authorization are stable, a read-only MCP
server may expose artifact listing, evidence search, citation retrieval,
calculation, and scenario comparison. It must be a thin protocol adapter over
the same application commands, not a second tool implementation.

CarbonSage may later dogfood Ceiba for execution, observability, evaluation, or
tool registration. CarbonSage must remain independently deployable until
Ceiba's production boundary is explicitly reviewed and selected.

## Compatibility boundary

CarbonSage is the public product identity. Historical `nzeroesg-*` directories,
service names, environment variables, cookie names, and deployed URLs remain
unchanged for now so the verified deployment is not disrupted by the rebrand.

The authoritative sequence and acceptance gates are in
[`demo-roadmap.md`](demo-roadmap.md). The retrieval and orchestration evaluation
plan is in [`langchain.rag.workflow.md`](langchain.rag.workflow.md).
