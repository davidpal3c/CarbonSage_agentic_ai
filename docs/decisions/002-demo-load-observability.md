# ADR 002: Measure demo workspace readiness before optimizing it

- Status: Accepted
- Date: 2026-08-24
- Scope: `POST /demo/data` and the client refresh that follows it

## Context

Loading CarbonSage's fictional workspace has taken roughly 50–72 seconds in
production. That elapsed time currently combines several different systems:
Render process wake-up, Neon connection establishment and writes, document
extraction, embedding-provider requests, pgvector writes, and the client's
follow-up hydration requests. A single stopwatch cannot identify the dominant
stage or prove that a later change improved it.

## Decision

CarbonSage records one bounded timing trace for every demo-load request:

- `status`: the idempotency/readiness check;
- `parse`: local CSV parsing and validation;
- `prepare`: supplier normalization, local evidence extraction, and artifact
  construction before persistence;
- `relational`: artifact, shipment, supplier, lane, and evidence writes;
- `embeddings`: zero during demo loading because indexing is deferred;
- `finalize`: the final workspace-state and readiness checks;
- `bootstrap`: assembly of the versioned client-hydration snapshot; and
- `total`: end-to-end API handler time.

The API returns these timings in an optional `performance` object, emits a
`Server-Timing` header for browser inspection, and writes a structured summary
to application logs. `process_state` distinguishes requests observed during the
first two minutes of a process from requests on an older process. It is an
operational hint, not proof that the hosting platform performed a cold start.

The client also creates a `carbonsage:demo-data-load` Performance API measure
that separates the POST duration from applying the returned bootstrap snapshot
to the workspace store.

## Measurement and acceptance

We will evaluate production samples separately for `recent_start` and
`warm_process`, and report p50 and p95 instead of relying on one manual run.
The immediate target for the next slices is:

- warm relational stage p95 below 2 seconds;
- client hydration p95 below 3 seconds after the POST resolves; and
- no regression in idempotency, rollback safety, or workspace isolation.

Embedding latency is no longer on the demo-load request path. The five demo
documents are stored with their lexical indexes during loading. The existing
semantic and hybrid search path indexes missing vectors on the first such
search. This keeps the public demo load independent of five sequential external
embedding requests, which can otherwise hold the browser request open long
enough to fail at a network intermediary. The first semantic or hybrid search
can take longer while those vectors are created; lexical search is ready as
soon as loading completes. The remaining synchronous database work runs in
FastAPI's worker threadpool so the API event loop can continue serving other
requests while a workspace is seeded.

## Consequences

- The demo response gains optional diagnostic metadata; existing clients remain
  compatible.
- Logs contain workspace identifiers but no document contents, credentials, or
  user prompts.
- Timing calls add negligible local overhead and make future optimization claims
  falsifiable.
