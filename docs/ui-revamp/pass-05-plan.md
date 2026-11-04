# Pass 05 plan — enterprise work surfaces

Status: planned after Pass 04, 3 November 2026. Build on the current tip of
`design/carbonsage-ui-revamp` in the original `nzeroesg app` repository.

## Goal

Carry Pass 04's lean, neutral dashboard system through the remaining workspace
pages. The shell and Overview now use a 224 px desktop sidebar, 36 px desktop
navigation rows, a compact metric strip, a 220 px trend chart, and 16 px
section/card rhythm. The other pages should feel like one professional product
without flattening their distinct workflows.

## Scope

1. Audit every workspace route at 1440, 768, 430, and 375 px, in light and
   dark. Inventory page headers, card padding and radii, table and list rows,
   forms, chips, chart sizing, agent panels, artifact viewer, empty/error and
   loading states. Note content or controls that require more space.
2. Establish a small shared set of workspace presentation patterns at their
   owning layer. Use them across Agent, Shipments, Suppliers/Evidence,
   Artifacts, Scenarios, Integrations, Report, and How to. Retain conventional
   readable controls, scannable values, subtle boundaries, and accessible
   focus. Avoid broad CSS selectors that could alter public pages.
3. Refine the agent page for reading and acting on structured answers:
   citations, source locations, tool activity, charts, warnings, and suggested
   actions must stay clear. Keep the chat launcher and embedded behavior.
4. Refine data work surfaces: shipment analytics, supplier search and evidence,
   scenarios, artifact catalog/viewer, integration cards, report/export, and
   How to. Use density to reduce unused space while keeping long names,
   numeric precision, validation errors, and keyboard operation intact.
5. Recheck the 375 px Suppliers search label and dark-theme first paint after
   shared styling changes. Keep report print layout, 200% zoom, and mobile
   drawer behavior stable. Do not add a geographic map in this pass.

## Acceptance

- First desktop viewport of each major page communicates its task and exposes
  the primary controls or data without oversized empty cards. Mobile pages
  have no horizontal page overflow; wide data tables may scroll in named
  regions.
- 14 px body/table text remains readable where appropriate, with larger
  headings and values where hierarchy needs them; interactive targets stay
  usable by pointer and keyboard. Contrast and focus are checked on rendered
  surfaces.
- Demo entry/load, exact values and units, factor and citation provenance,
  agent responses, artifact actions, imports, exports, report print, session,
  navigation, and error handling behave as before.
- Before/after captures, a short page-by-page decision log, typecheck, lint,
  format check, build, and relevant browser flows are delivered. Report
  performance or bundle changes if new dependencies are introduced.

This pass changes presentation and shared UI ownership only. The broader
product/data roadmap and later mapped shipment evaluation remain in
[`roadmap.md`](roadmap.md).
