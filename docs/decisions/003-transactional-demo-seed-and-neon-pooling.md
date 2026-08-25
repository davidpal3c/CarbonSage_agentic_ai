# ADR 003: Seed relational demo data atomically through a bounded Neon pool

- Status: Accepted
- Date: 2026-08-24
- Scope: PostgreSQL access and the relational portion of `POST /demo/data`

## Context

The original demo loader called repository methods for each artifact and
supplier. Every method acquired a connection, executed a small transaction,
and committed independently. On a remote Neon database this amplified network
round trips and could leave a partially populated workspace if a later write
failed. It also made the 50–72 second production load hard to reason about.

Render may run more than one API request concurrently, while Neon's free and
entry-level environments should not be treated as an unlimited connection
budget. CarbonSage therefore needs both atomic seed behavior and a deliberately
small application-side pool.

## Decision

For PostgreSQL-backed workspaces, CarbonSage writes the relational demo graph
in one transaction on one pooled connection:

- one advisory transaction lock serializes concurrent seeds for a workspace;
- the loader rechecks workspace emptiness after acquiring that lock;
- suppliers, artifacts, shipments, declared supplier lanes, evidence documents,
  and evidence chunks are inserted as one unit; and
- any failure rolls the entire seed back.

Embedding-provider calls and pgvector updates remain outside this transaction.
They involve external latency and must not keep a database transaction or pool
lease open. Evidence artifacts are inserted as `processing` and become `ready`
after their embeddings have either been indexed or explicitly reported as
unavailable by the existing semantic-index policy.

All PostgreSQL repositories share one lazy Psycopg connection pool per process
and connection URL. The defaults are:

- minimum idle connections: `0`;
- maximum connections: `4`;
- acquisition timeout: `15` seconds; and
- idle connection lifetime: `60` seconds.

Production should provide Neon's pooled `-pooler` connection string as
`DATABASE_URL`. CarbonSage does not rewrite a direct URL automatically because
that can silently select the wrong host or environment.

## Verification gate

- API and deterministic-agent suites pass without database credentials.
- A PostgreSQL integration test injects a failure before commit and verifies
  that artifacts, suppliers, shipments, and service lanes all remain absent.
- A successful PostgreSQL seed verifies the complete relational counts and
  idempotent second invocation.
- The observability contract from ADR 002 remains intact so production p50/p95
  can validate the latency impact rather than relying on one manual sample.

## Consequences

- Relational seed latency uses a bounded number of network round trips and
  cannot expose a half-created workspace.
- Repository callers keep their existing close/commit behavior; closing a
  pooled lease rolls back any unfinished transaction before returning it.
- Process concurrency is capped locally, while Neon's pooled endpoint handles
  platform-side connection multiplexing.
- Semantic indexing is still synchronous in this slice. Moving it off the load
  critical path remains a separate architectural decision.

## References

- [Psycopg connection pool](https://www.psycopg.org/psycopg3/docs/api/pool.html)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
