# Pass 05 report: enterprise work surfaces

Branch `design/pass-05-enterprise-surfaces` in the original `nzeroesg app`
checkout, from `design/carbonsage-ui-revamp` at `2fabbe7`. Presentation only: no
API, storage, model, calculation, retrieval or product-capability change; no map
view; no new dependency. Review captures and scripts are in
`_workspace/ui-pass-05-review/` (untracked artifact folder).

## Survey: what made the other pages heavy

Surveyed all eight surfaces (Agent, Shipments, Suppliers, Artifacts, Scenarios,
Integrations, Report, How to) plus Overview and the shell, light and dark, at
1440, 768, 430 and 375 px (72 captures before, 72 after, plus 36 empty-state).
Causes, with where they lived:

- Page titles at `text-3xl sm:text-4xl` and `py-7 lg:py-9` page padding on
  Agent, Integrations, Scenarios, Report and How to (each route owned its header).
- `rounded-xl` / `rounded-2xl` cards at `p-5 sm:p-6` everywhere; shadows on the
  chat panel, assistant bubbles and modals (`shadow-2xl`, a coloured message shadow).
- KPI figures as three large boxed cards on Shipments and Report.
- Table rows at `py-3`/`px-4`, 10 and 11 px mono-caps eyebrows (Artifacts rows,
  artifact viewer, usage panel), uppercase table headers.
- Two-column supplier cards with `p-4`, pill chips, 56-60 px artifact rows.
- Suggested-prompt pills with rotating coloured shadows; a chat panel capped at
  38-50 rem tall; assistant bubbles at 88% width though they hold tables/charts.
- The Suppliers search label wrapping to a 60 px sliver at 375 px (flex basis 0).

## Shared patterns (one owner)

`app/dashboard/workspace-ui.tsx`, workspace tokens only, not imported by public code:
`WorkspacePage` (16/20/24 px frame), `PageHeader` (24 px title, 14 px lead),
`Card` (16 px padding, hairline, `rounded-lg`), `MetricStrip` (one bordered strip
of monospaced figures with a smaller unit), `buttonPrimary/Secondary` (40 px
targets on touch, 36 px with a pointer), `chipClass`, `IconTile`, `EmptyNotice`.
Overview's panel rhythm from Pass 04 is the reference. No global scale transform,
no body text under 14 px except labels at 12 px, no selector that can reach the
public site.

## Page-by-page decisions

| Page            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent           | Compact header and shared buttons; chat panel `rounded-lg`, no shadows, height `100vh - 9.5rem` (min 30 rem) so the answer gets more of the viewport; assistant answers use 96% width, user messages 80%; header, conversation bar and message padding tightened; details panel, structured blocks, tables, citations, warnings and actions keep their markup and only lose oversized radii, shadows, uppercase and 10-11 px text; suggestions become one quiet bordered chip style. Launcher/embedded behaviour and session controls untouched. |
| Shipments       | KPI cards → `MetricStrip`; filter row and charts in `p-3`/`p-4` hairline cards; table rows 32 px with 12 px headers (no uppercase); tighter section rhythm so charts start sooner.                                                                                                                                                                                                                                                                                                                                                               |
| Suppliers       | Search row at the shared control height; the label no longer collides at 375 px (it takes the full row); supplier cards 3 per row at xl, `p-3`, small chips; add-supplier dialog `rounded-lg`, shadow reduced, 14 px inputs.                                                                                                                                                                                                                                                                                                                     |
| Artifacts       | Header and rows compacted (row ≈44 px), 12 px muted type labels instead of 10 px caps, chips `py-0.5`; actions menu and expanded detail unchanged. Artifact viewer: `rounded-lg`, no 10 px eyebrow, shared 36/40 px buttons.                                                                                                                                                                                                                                                                                                                     |
| Integrations    | Two `Card`s with `IconTile`, 16 px padding, shared buttons and chips; same text and actions.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Report          | Controls in one compact toolbar (hidden in print), `MetricStrip`, comparison and mode table as `Card`s with right-aligned monospaced figures; exact values and `CO2e` strings unchanged.                                                                                                                                                                                                                                                                                                                                                         |
| Scenarios       | `EmptyNotice` instead of a 288 px card.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| How to          | Compact numbered list (about 56 px per step instead of ~110), same copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Overview, shell | Unchanged from Pass 04 (consistency checked; the new patterns match its panel rhythm). Homepage product glimpse unchanged because Overview did not change.                                                                                                                                                                                                                                                                                                                                                                                       |

Also: suggestion chips no longer rotate colours or cast shadows, so two Pass 04
assertions were updated to the new intent (see Proof).

## Proof

From `nzeroesg-client`, against the real local API (in-memory store):

| Command                                                       | Result                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                                           | pass (exit 0)                                                                                                                                                            |
| `npm run lint`                                                | pass (exit 0)                                                                                                                                                            |
| `npm run format:check`                                        | pass (exit 0)                                                                                                                                                            |
| `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run build` | pass                                                                                                                                                                     |
| `npm run test:e2e`                                            | 30/30 passed (3.6 min) on a quiet machine. A first run under load failed 3 specs on navigation timeouts; two passed on rerun and one needed an assertion update (below). |

Two existing assertions were changed because they asserted removed decoration,
not behaviour: suggested prompts no longer need different border colours (now: one
shared visible control border), and the assistant answer is set apart by a hairline
border rather than a box-shadow. Both in `e2e/demo.spec.ts`; all citation, chart,
table and action assertions are unchanged.

Rendered pixels (scripts in the review folder):

- **Contrast** (`audit.mjs`, text vs real pixels, 3:1 control borders): all nine
  routes, light and dark: 2,012 items at 1440 and 1,562 at 375, **0 active
  failures** (8 disabled controls at each width, exempt).
- **Overflow:** none in 72 + 36 survey captures at 1440/768/430/375, nor in the
  long-content run.
- **200% zoom** (720 px at 2x): no overflow on all nine routes in both themes (18 pages).
- **Focus:** 2 px sage ring visible and measured on Shipments, Suppliers search,
  Artifacts, Report and Integrations controls in both themes.
- **Mobile drawer:** lists all eight routes plus How to and home at 375 px.
- **Suppliers label at 375 px:** no overlap (search label ends at y=291, retrieval
  starts at y=303; before, the label wrapped to a 60 px sliver).
- **Dark first paint:** unchanged since Pass 04's head script; `/login` with a
  saved dark theme and no JavaScript painted dark (Pass 04 evidence still applies).
- **Long content:** a 120-character supplier name, long region, seven
  certifications and a 120-character evidence filename wrap without overflow at
  1440 and 375 (`after/long/`).
- **Report print (manual, print media):** sidebar and top bar hidden, buttons and
  the controls card hidden (`print:hidden`, added: it previously left an empty
  "Report alternative" box), white page, title, metric strip, scenario and mode
  table visible; A4 PDF in `after/checks/report-print.pdf`.
- **Source/citation (manual and test):** the existing Playwright flow still opens a
  citation preview and returns focus; `agent-response-*` captures show the
  structured answer (metric, table, chart, citation, artifact reference, warning,
  action, suggestions) at 1440, 768 and 375 px in both themes.

No dependency was added; bundle and build output are unchanged in kind. Only
class names and a small shared module changed.

## Follow-up: midpoint sizing (requested after review)

The review asked for two changes, and this section supersedes the sizes quoted
above for the work surfaces.

**Landing page: nothing to roll back.** Pass 05 changed no public file (the only
shared file touched was `globals.css`, and only the `.agent-suggestion*` rules used
inside the chat panel). To prove it, the pre-Pass-05 source (`2fabbe7`) and the
current build were rendered side by side and every public capture was
pixel-diffed: home and `/login`, 1440/768/430/375 px, light and dark, viewport and
full page: **32 captures, 0 pixel differences, 0 size differences**
(`_workspace/ui-pass-05-review/public-check/`). The homepage and its product
glimpse are exactly as they were before Pass 05.

**Workspace: midpoint between Pass 04 and Pass 05.** Every element Pass 05 shrank
was moved to roughly halfway between its Pass 04 and Pass 05 size, using the three
builds measured in a browser at 1440 x 900 (`scripts/measure.mjs`):

| Measure                                                      | Pass 04     | Midpoint                | Pass 05     |
| ------------------------------------------------------------ | ----------- | ----------------------- | ----------- |
| Page title on Agent, Report, Integrations, Scenarios, How to | 36 px       | 30 px                   | 24 px       |
| Page padding (x / y) on those pages                          | 40 / 36 px  | 32 / 28 px              | 24 / 20 px  |
| Card padding (Report)                                        | 20 px       | 18 px                   | 16 px       |
| Toolbar padding (Report)                                     | 20 px       | 16 px                   | 12 px       |
| Total-emissions value (Report)                               | 24 px       | 22 px                   | 20 px       |
| Table row (Report)                                           | 45 px       | 39 px                   | 33 px       |
| Table row (Shipments)                                        | 33 px       | 31 px                   | 29 px       |
| Supplier card height / padding                               | 154 / 16 px | 134 / 14 px             | 114 / 12 px |
| Supplier cards per row at 1440                               | 2           | 2 (3 only from 1536 px) | 3           |
| Artifact row                                                 | 72 px       | 63 px                   | 57 px       |
| How to step                                                  | 147 px      | 124 px                  | 95 px       |
| Scenarios empty card                                         | 302 px      | 288 px                  | 264 px      |
| Agent chat panel (900 px viewport)                           | 724 px      | 736 px                  | 748 px      |
| Sidebar width, button height (36 px)                         | unchanged   | unchanged               | unchanged   |

Shipments, Suppliers, Artifacts and Overview keep their Pass 04 frame, title
(24 px) and header, because those were identical in Pass 04 and Pass 05; only
their cards, table rows, chips, form spacing and supplier layout moved to the
midpoint. No element ended up larger than its Pass 04 size. Titles are no longer
identical across pages (30 px on the five pages that were 36 px, 24 px on the
others), as in Pass 04 but with a smaller gap. Everything else in this report
(structure, shared module, behaviour, checks) is unchanged.

Rechecked on the midpoint build: typecheck, lint, format (exit 0), **30/30
Playwright**, no overflow in 72 survey captures at 1440/768/430/375, 200% zoom with
no overflow on 18 pages, drawer lists all routes, Suppliers label has no overlap at
375 px, report print layout intact. Contrast was not re-audited because no colour
changed in this follow-up (Pass 05's 0 active failures at 1440 and 375 stands).
`comparison-mid.png` shows Pass 04, the midpoint and Pass 05 side by side.

## Method

OrchestrA material read and applied as method: `redesign-existing-projects` (the
audit list for generic card/box-shadow combinations, pill chips, oversized titles,
all-caps labels and flat cards drove the survey and replacements), `break-ui` (the
worst-case content run above), and the platform working rules (rendered-pixel
checks, no restyle that can change behaviour, print and functionality preserved).
`design-taste-frontend` was not read in full. `docs/demo-roadmap.md` and
`docs/carbonsage-ecosystem-vision.md` were skimmed by headings only; the Next.js
docs were consulted for the installed 16.4.3 `images` behaviour in Pass 04 and not
re-read for this CSS-only pass. Dashboard reference 1 was not visible to this
builder; hierarchy and density follow the written brief and Pass 04's measured
Overview.

## Remaining

1. The agent page cannot be exercised with a live model here (assistant disabled);
   structured answers were reviewed through the mocked responses used by the tests.
2. Dense tables still scroll horizontally on phones inside their wrappers (by design).
3. Shipments' empty state offers Import in the header but no inline "Load demo data".
4. Screen reader, Safari and Firefox review remain for the release pass.

## Test it

The original checkout is on the pass branch with a clean tree.

```bash
cd nzeroesg-api && APP_ENV=development DATABASE_URL= EMBEDDING_PROVIDER= ASSISTANT_ENABLED=false CORS_ORIGINS=http://127.0.0.1:3000 ../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
cd nzeroesg-client && NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/`, **Try the demo → Enter demo workspace → Load demo
data**, then visit each page in the sidebar in both themes. Checks:
`npm run typecheck && npm run lint && npm run format:check && npm run test:e2e`.
