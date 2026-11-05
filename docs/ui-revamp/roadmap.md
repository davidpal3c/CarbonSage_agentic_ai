# CarbonSage UI revamp roadmap

Status: Pass 05 released, 5 November 2026. The central integration branch is
`design/carbonsage-ui-revamp`; production `main` remains a separate release.

## Current position and reference assessment

Pass 03 established an Atalanta-led public site and neutral workspace shell and
Overview. Pass 04 added the CO₂-inspired mark, dot-matrix wordmark, evidence
scroll story, varied media composition, and leaner shell/Overview. Inner
workspace pages retain older roomy cards and inconsistent density. Today's demo
covers freight and transportation suppliers across air, truck, ship, and train.
Wider Scope 3 procurement and a
marketplace remain future possibilities, not current product claims.

- **Atalanta:** Keep the warm olive/paper restraint, rail, whitespace, quiet
  type, and photographic authority as the public foundation.
- **Waabi home and Safety:** Adapt varied offset photo/text sections, selective
  parallax, and one central scroll-linked trajectory pointer. Make that pointer
  explain CarbonSage's evidence lineage. Study its typographic roles; license
  exact fonts if chosen, or use a suitable licensed alternative. Do not copy
  assets, logo, accent color, or exact compositions.
- **First supplied dashboard reference:** Borrow the compact metric strip,
  efficient rows, and chart/data hierarchy, while avoiding its tiny text and
  dated styling. **Second reference:** Reserve the geographic evaluation idea
  for the later mapped-view pass; its neon HUD treatment is not the dashboard
  direction.
- **Historical CarbonSage palette:** `baseline/pre-ui-revamp-2026-11-02`
  (`355f92e`) preserves purple `#4a4466`, green `#597a64`, and blue-gray
  `#4b7480` as a distinctiveness reference.

## Pass 04 — identity, public narrative, workspace density (complete)

1. Design an original simple CO₂-inspired three-node/two-bond mark. Pair
   dot-matrix “Carbon” with clean grotesque “Sage”; supply large, compact, and
   mark-only lockups. Check small sizes, accessible naming, light/dark use,
   and font rights. Relate the mark's line subtly to the evidence trajectory.
2. Recompose repeated media bands into varied editorial sections with
   purposeful licensed imagery across transport, industry, and environment.
   Build one centered scroll story: operational input → deterministic
   calculation → cited supplier evidence → decision. Use restrained parallax
   on selected images; retain readable static content under reduced motion.
3. Make shell and Overview meaningfully leaner: sidebar, headers, section
   rhythm, cards, KPI strip, chart footprint, and tables. Survey Shipments and
   Suppliers and fix shared density patterns where needed. Preserve readable
   text, focus, usable targets, 200% zoom, and mobile layouts. Density should
   come from hierarchy and less unused space, not globally tiny typography.
4. Review rendered desktop/tablet/mobile, empty/seeded Overview, light/dark,
   motion/reduced motion, loading, exact values/units, and demo path. Compare
   LCP and transfer with Pass 03: mobile home LCP 1,328 ms (formerly 864 ms),
   desktop home transfer 565 KB (formerly 308 KB). Motion must not gate content
   or add a heavy runtime.

Pass 04 is presentation work. Keep API, retrieval, calculations, storage,
agent response semantics, routes, and current product capability claims.
Builder instructions: [`builder-pass-04.md`](builder-pass-04.md).
The review and integration record is in
[`pass-04-planner-review.md`](pass-04-planner-review.md).

## Pass 05 — remaining enterprise work surfaces (complete)

Carry the approved density system through Agent, Shipments, Suppliers,
Artifacts, Scenarios, Integrations, Report, and How to. Recheck the 375 px
Suppliers label and dark-theme first paint after shared styling changes.
Preserve citations, provenance, data tables, exports, print, and session
behavior. The reviewed result, including the user's sizing change, is at
`d17dccf` on the central branch, `dev`, and `main`.
The build scope and handoff are in [`pass-05-plan.md`](pass-05-plan.md) and
[`builder-pass-05.md`](builder-pass-05.md); review in
[`pass-05-planner-review.md`](pass-05-planner-review.md).

## Pass 06 — guided supplier questions, report export, and interface polish

Make broad supplier questions useful through evidence-backed narrowing, while
keeping exact-lane recommendations bounded. Add a detailed PDF export with
graphics alongside CSV in one export menu. Fix the chat composer spacing.
Keep the public homepage in light mode and add the requested footer contact.
The implementation brief is in [`pass-06-plan.md`](pass-06-plan.md) and
[`builder-pass-06.md`](builder-pass-06.md).

## Pass 07 — final media and release review

Source commercial freight imagery to replace the temporary air runway and road
landscape, refine the dark hero crop/scrim, and record media sources/licenses.
Review responsive layout,
keyboard, screen reader, Safari, Firefox, zoom, contrast, print, and
performance. Review Pass 06's PDF rendering and broad-question behavior with
real data. Decide separately when to release further changes to production.

## After the UI/UX revamp — mapped trajectory evaluation

Plan a map-based shipment/trajectory evaluation across air, truck, ship, and
train. First define the decision use case, route/geographic data contracts,
mode-specific path assumptions, comparison metrics, source provenance, and a
useful table equivalent. Then prototype map interactions. This is a later
product/data pass, rather than a decorative map in Pass 04, and should remain
compatible with a future broader Scope 3 procurement scope.
