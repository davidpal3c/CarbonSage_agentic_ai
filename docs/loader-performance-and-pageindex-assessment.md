# Demo loader measurement and PageIndex assessment

Date: 2026-10-29

## What is deployed and what was measured

The pre-release public `main` deployment took 37.5 seconds to first byte for
one fresh demo load on 2026-10-29. Session creation immediately beforehand took
1.4 seconds; that observation did not establish a Render wake-up as the main
cause. The old POST performed separate repository writes and five sequential
embedding-provider calls. One old sample is not a controlled baseline.

The production release on 2026-10-29 adds an atomic PostgreSQL seed, defers demo
embeddings until semantic or hybrid search, and returns one versioned bootstrap
snapshot. Both public services were deployed and the API returned
`performance.stages_ms`, `Server-Timing`, and bootstrap version `1.0`.

### Production measurements

Twenty new workspaces were sampled through the public Render API. Each sample
created a session, requested the initial bootstrap, loaded demo data, and
revoked the session. All 20 loads returned HTTP 200 with 58 shipments, 38
suppliers, six artifacts, and the expected bootstrap version. Times below are
milliseconds; p95 uses nearest rank. Client wall time includes the public
network path and response transfer. The sanitized per-sample responses are in
[`measurements/production-demo-loader-2026-10-29.json`](measurements/production-demo-loader-2026-10-29.json).

| Measure | p50 | p95 |
| --- | ---: | ---: |
| Session creation, client wall | 586 | 676 |
| Initial empty bootstrap, client wall | 777 | 834 |
| Demo POST, client wall | 3,038 | 3,189 |
| Demo handler total | 2,764 | 2,931 |
| Status reads | 470 | 482 |
| Parse | 4 | 8 |
| Prepare | 1 | 1 |
| Relational writes | 1,749 | 1,868 |
| Embeddings | 0 | 0 |
| Finalize reads | 524 | 559 |
| Bootstrap assembly | 3 | 8 |

The API labels the first 14 samples `recent_start` because the process was
under two minutes old. Their demo POST client p50/p95 was 3,058/3,380 ms and
handler p50/p95 was 2,768/3,143 ms. The six `warm_process` samples were
3,018/3,047 ms client and 2,764/2,787 ms handler. These labels measure process
age, not a proven cold start. All samples were taken while the API was active;
an after-idle wake-up remains unmeasured.

Three settled public Chromium runs reached Overview 1,996–2,552 ms after the
workspace-entry click and rendered the demo chart 3,267–3,289 ms after the
load click. Each used one bootstrap request and no follow-up collection
requests for shipments, suppliers, or artifacts. One earlier browser attempt
during the release did not reach Overview within 90 seconds; its cause was not
captured, and four later browser runs succeeded. This remains a reliability
observation, not evidence of a recurring failure.

Relational writes account for about 1.75 seconds of the 2.76-second median
handler time. Status and finalize reads account for about another second.
This makes database round trips and placement the next evidence-based latency
target. The 37.5-second pre-release sample and the new roughly 3-second POST
show a substantial observed improvement, but differ in timing and deployment.

### Local measurements

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

## Next measurement and optimization

Inspect Neon region relative to Render, pool acquisition, SQL round trips,
and query plans before changing the seed. The status and finalize snapshots
also merit review because together they cost about one second. Measure a fresh
load after an actual idle period before attributing any remaining tail latency
to the free API plan. If warm loads remain fast but after-idle loads are slow,
an always-on API plan is the direct infrastructure remedy. Keep public p50,
p95, error rate, and browser time-to-chart visible after each change.

One production check on a newly loaded workspace found that the first semantic
search took 5,581 ms client wall time and a repeat search took 1,069 ms. Both
returned five matches. This is only one pair, but it confirms that deferred
indexing moves a measurable cost to the first semantic query. Measure its p95
and error rate before relying on that path for a time-sensitive workflow.
User-uploaded evidence still indexes inside its upload request; a durable
ingestion job and explicit readiness state would be appropriate when real
documents make that request too slow or unreliable.

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
