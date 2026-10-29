# Demo loader measurement and PageIndex assessment

Date: 2026-10-29

## What is deployed and what was measured

The public `main` deployment still returns the pre-observability demo-load
response, without `performance` or a bootstrap snapshot. A fresh public
workspace loaded in 37.5 seconds to first byte on 2026-10-29. Session creation
immediately beforehand took 1.4 seconds, so that sample does not indicate a
Render process wake-up as the dominant delay. The deployed code still performs
separate repository writes and five sequential embedding-provider calls during
the POST. There is no production stage breakdown until the newer code is
deployed.

The proposed loader change adds an atomic PostgreSQL seed, defers demo embeddings
until semantic or hybrid search, and returns one versioned bootstrap snapshot.
Five fresh loads against disposable local PostgreSQL 16 with pgvector 0.8.6
had these timings in milliseconds:

| Sample | Client/TestClient wall | Handler | Status | Parse | Prepare | Relational | Embeddings | Finalize | Bootstrap |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 101 | 91 | 9 | 3 | 1 | 58 | 0 | 14 | 5 |
| 2 | 198 | 187 | 19 | 5 | 1 | 139 | 0 | 19 | 4 |
| 3 | 104 | 94 | 13 | 4 | 1 | 60 | 0 | 13 | 3 |
| 4 | 134 | 122 | 10 | 3 | 1 | 92 | 0 | 12 | 4 |
| 5 | 369 | 352 | 170 | 6 | 2 | 139 | 0 | 29 | 7 |

Each response contained 58 shipments, 38 suppliers, six artifacts, and about
49 KB of JSON. These are local measurements, not predictions for the
Render-to-Neon path. Five samples are too few for a useful p95 estimate.

## Release and measurement gate

1. Complete and review the current loader/bootstrap work. Run backend,
   PostgreSQL, frontend, and browser checks before promotion through `dev` and
   `main`.
2. After both services deploy, confirm `POST /demo/data` returns
   `performance.stages_ms`, `Server-Timing`, and bootstrap schema version `1.0`.
   A response without those fields is still the old deployment.
3. Collect at least 20 fresh-workspace samples across warm and idle periods.
   Record client time to usable dashboard, API handler time, stage durations,
   process state, and failed loads. Report p50 and p95 separately for recent
   process starts and warm processes.
4. Optimize the measured dominant stage. If relational work is slow, inspect
   Neon region, pool acquisition, SQL round trips, and query plans. If warm
   loads are fast but idle loads are slow, an always-on API plan is the direct
   infrastructure remedy. Do not move platforms based on the old 37.5-second
   sample.

The deferred demo index makes the first semantic or hybrid query potentially
slower. Measure that separately. User-uploaded evidence still indexes inside
its upload request; a durable ingestion job and explicit readiness state would
be appropriate when real documents make that request too slow or unreliable.

## PageIndex decision

[PageIndex](https://docs.pageindex.ai/getting-started) builds a tree for each
document and uses an LLM to navigate it at query time. Its local mode supports
text-based PDFs with page-level citations; its cloud mode adds scanned and
image-rich documents and finer citations. Its own
[query-cost guide](https://docs.pageindex.ai/cookbook/query-cost) notes that
questions spanning many documents require many model calls.

**Corpus size alone never strictly requires PageIndex.** More small documents
first call for indexing, filtering, query-plan, and retrieval-quality work on
the existing PostgreSQL search path. A large number of vectors may justify an
ANN index or partitioning after measurement, but neither implies tree search.

Run a PageIndex pilot only when the product needs long, structured or scanned
reports, cross-references, tables, or multi-document synthesis that the current
text extraction and lexical/hybrid retrieval fail to find reliably. Before a
pilot, build a held-out set of representative customer documents and questions,
including unanswerable and conflicting claims. Compare source-finding recall,
correct page or block citation, supported-answer rate, p95 query latency,
indexing time, provider cost, and workspace isolation. Try section-aware
extraction and reranking in the existing stack first if they address the same
failures with less complexity.

Adopt PageIndex as an optional retrieval path only if the pilot materially
improves the required evidence-quality target while meeting latency, cost,
retention, and tenant-isolation requirements. Keep deterministic shipment
calculations, supplier records, authorization, and canonical citations in the
application. Do not route all corpus sizes through PageIndex by default.
