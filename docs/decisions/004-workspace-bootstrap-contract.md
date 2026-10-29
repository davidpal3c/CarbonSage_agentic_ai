# ADR 004: Hydrate the workspace through one versioned bootstrap contract

- Status: Accepted
- Date: 2026-10-29
- Scope: initial workspace hydration and the client refresh after demo seeding

## Context

After `POST /demo/data` completed, the client issued separate requests for
shipments, suppliers, and artifacts before the Overview became useful. Initial
workspace entry also fetched demo status before each page requested its own
data. The Zustand cache prevented repeat route loads, but it could not remove
the first network fan-out or guarantee that all initial slices represented the
same completed seed.

The focused shipment, supplier, and artifact endpoints remain useful for
mutations, filtered analysis, downloads, and independently refreshable pages.
Replacing them with one large general-purpose API would blur those boundaries.

## Decision

CarbonSage adds a bounded bootstrap contract with schema version `1.0`:

- `GET /demo/data/bootstrap` returns demo readiness, the current normalized
  shipment response and default analysis, supplier cards, and active artifacts;
- `POST /demo/data` includes the same `bootstrap` payload after an idempotent
  existing-data result or a completed seed; and
- the response is private and non-cacheable and exposes
  `X-CarbonSage-Bootstrap-Version: 1.0`.

The client hydrates the demo, shipment, default analytics, supplier, and
artifact Zustand slices in one state update. Initial workspace entry performs
the session check and then one bootstrap request before mounting page content.
A successful demo load does not issue follow-up requests for `/shipments`,
`/suppliers`, or `/artifacts`.

Bootstrap assembly is a named server-timing stage and remains part of the
end-to-end demo-load measurement introduced by ADR 002. Reports, conversations,
artifact contents, filtered shipment analytics, and provider health are not in
the bootstrap payload because they are either optional, potentially large, or
have independent freshness and authorization behavior.

The canonical resource endpoints remain unchanged. They are still used for
focused refreshes after mutations and provide a compatibility fallback if the
bootstrap request fails.

## Verification gate

- Empty and populated bootstrap responses validate against the same typed
  schema and carry the version, privacy, and timing headers.
- The bootstrap shipment analysis, suppliers, and artifacts reconcile with the
  canonical resource endpoints.
- Repeating the demo seed returns an idempotent bootstrap snapshot.
- Browser coverage verifies that initial entry plus demo loading does not call
  the three canonical collection endpoints and that cached navigation still
  works.
- Backend, frontend, production build, and narrow-viewport workflows remain
  green.

## Consequences

- Reviewer-visible hydration loses three post-seed network round trips and the
  first page no longer assembles its baseline from independently arriving
  responses.
- The bootstrap schema must be versioned when a breaking field change is
  necessary.
- Payload size grows with the bounded demo dataset. The existing shipment-row,
  supplier, artifact, and upload limits keep it suitable for this initial
  product; pagination or a summary-only contract would be required before
  materially increasing those limits.
- The subsequent loader change defers demo embeddings until semantic or hybrid
  search. Production timing still needs to be measured after release; see
  [`loader-performance-and-pageindex-assessment.md`](../loader-performance-and-pageindex-assessment.md).
