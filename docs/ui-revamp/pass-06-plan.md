# Pass 06 plan — guided decisions and report delivery

Planned 5 November 2026. Base: `design/carbonsage-ui-revamp` at `d17dccf`.
The original repository is the only checkout. The builder implements on
`design/pass-06-guided-decisions-report`; Codex reviews and integrates.

## Findings and intended behavior

1. **Public theme and contact.** `PublicHeader.tsx` renders `ThemeToggle` in
   desktop and mobile navigation. Root `layout.tsx` applies the saved or system
   dark theme before hydration; `.dark .surface-public` in `globals.css` then
   darkens the public page. Remove both header controls and make the homepage
   light by default, including when the workspace preference is dark. Preserve
   its intentionally dark editorial bands and workspace theme control. Add a
   visible `David P.` link to `https://davidpalacios.dev` in the `HomePage.tsx`
   footer near the existing links/credits.
2. **Report export.** `report/page.tsx` currently offers CSV and browser Print
   as separate actions. `/reports/preview` and `/reports/export.csv` both build
   the same workspace-scoped typed report in `api/reports.py`. Add one Export
   control with CSV and PDF options. Generate a downloadable, detailed PDF from
   the same report data and authentication boundary. Include a clear title,
   UTC generation time, dataset counts, emissions by mode with legible vector
   graphics, scenario comparison, supplier evidence overview, methodology,
   assumptions, and warnings. Clearly distinguish calculated estimates from
   verified supplier disclosures. Do not silently omit sections that have no
   data; label them. Keep the CSV contract and snapshot behavior. Choose a
   server PDF library with a small, justified production footprint; a backend
   `export.pdf` endpoint avoids dependence on browser print styles and makes
   graphics deterministic. Handle pagination, long names, and zero data.
3. **Broad supplier questions.** `agent/planner.py` only deterministically
   routes a supplier recommendation when it sees a weight and `from...to`
   route. The model policy has the same complete-route rule. The typed
   recommendation tool in `services/agent_tools.py` correctly insists on
   exact service lanes or supplier-linked shipment history. Country-wide or
   missing-route questions can therefore produce a generic warning, or a
   fictitious broad route attempt such as Canada→Canada. Add a typed,
   workspace-scoped discovery/narrowing path that uses actual service-lane and
   shipment coverage. A broad question should explain why there is no global
   best supplier, offer a few real lane examples or useful route/weight
   questions, and ask for the smallest missing detail. For a complete route
   and weight, keep the existing exact recommendation path. Do not rank unlike
   routes as comparable, infer live availability/pricing, fabricate supplier
   evidence, or weaken exact-lane abstention. Make follow-up turns work when
   the user supplies the requested missing detail. Keep response provenance
   and distinguish declared service from historical shipment coverage.
4. **Chat whitespace.** `ChatInterface.tsx` has fixed launcher heights of 36rem
   before an assistant answer and 48rem after one; embedded mode uses a fixed
   viewport formula plus a 34rem minimum, and `WorkspaceShell.tsx` adds bottom
   padding. `ChatInput.tsx` grows its textarea by `scrollHeight`. Reproduce
   the intermittent empty area around/below the composer across launcher and
   embedded states, including after sending/receiving, resizing, and mobile
   keyboard behavior. Fix the owning layout rule so the composer remains
   anchored, the message region takes surplus height, and there is no phantom
   gap or page overflow. Preserve scroll-to-latest and message readability.

## Acceptance and proof

- The homepage stays light after a saved/system dark preference; dark bands
  remain intentional; the workspace can still switch themes. Contact link is
  keyboard accessible and points to the exact requested URL.
- CSV export still downloads. The new PDF downloads with `application/pdf`,
  contains report numbers matching preview/CSV, graphics and methodology,
  paginates cleanly, and survives long and empty data. The export menu works
  with pointer, keyboard, and screen reader, and exposes loading/failure.
- Broad supplier requests receive data-backed narrowing, including a no-data
  case; exact unsupported routes still abstain. Test the observed broad
  phrasings, complete questions, follow-ups, and model-disabled fallback.
- Browser captures show the composer at the bottom of launcher and embedded
  panels before/after answers at desktop/mobile widths and 200% zoom, with no
  extra space under the input.
- Run targeted backend/agent/PDF tests, client checks, build, and relevant
  Playwright flows. Review actual PDF pages and rendered UI rather than only
  asserting response status. Report source locations and every new dependency.
