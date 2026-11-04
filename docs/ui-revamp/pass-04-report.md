# Pass 04 report: identity, narrative and lean workspace

Branch `design/pass-04-identity-narrative-density`, from `origin/design/carbonsage-ui-revamp`
at `e235e65`. No API, retrieval, calculation, storage or agent-parsing code
changed. Not merged, not deployed. Review captures, the comparison sheet and the
scripts are in the untracked pack `_workspace/ui-pass-04-review/` (see its README).

**Push status:** the instruction to push the pass branch before editing was
blocked by the environment's permission classifier (publishing to the remote).
The branch exists only in the local clone `_workspace/pass-04-builder` until it is
pushed; see "Test it" below.

## What changed

**Identity.** A new original mark: a CO₂ molecule as three nodes and two bonds
(oxygen, carbon, oxygen). The first bond is straight; the second steps up to the
last node, the same step the evidence journey makes. The wordmark sets "Carbon"
in a dot matrix drawn in the repo (a 5 x 7 grid, one SVG dot per lit cell, no
font involved) and "Sage" in Archivo 500, the grotesque already loaded for the
site. Variants: large (sign-in), compact (public header, workspace sidebar), and
mark only (phone header, footer). `BrandLockup` composes them; the wordmark and
the mark-only variant expose one accessible name, "CarbonSage".

**Public narrative.** The Pass 03 olive/paper base, rail, spine and type are
kept. The four repeated full-width transport bands are replaced by:

1. **Centred scroll story** (`ScrollStory`): operational input → deterministic
   calculation → cited supplier evidence → decision, on a line down the middle with
   a pointer (the mark's carbon node) that tracks the viewport centre and marks
   the active step's numeral. Static equivalent (no script or reduced motion):
   the same four steps in reading order, the line fully drawn, no pointer.
2. **Offset photo/text section** (freight lens): text and a real `<table>` of the
   four modes (shipments, share, in-row bar, 48 px photo legend) beside a large
   portrait rail photograph with a sea inset overlapping its edge.
3. **Overlapping editorial panel** (trust and limits): a paper panel overlaps the
   foot of a dark forest photograph.
   Parallax (`Parallax`) applies to the rail, inset and forest images only: a bounded
   transform (±40, ±20 and ±56 px) driven by one passive scroll listener per image,
   gated by an IntersectionObserver and `requestAnimationFrame`, no dependency, off
   under `prefers-reduced-motion`. Critical copy and the demo call to action do not
   depend on motion.

**Lean workspace.** Compact structure from hierarchy and less unused space, not
smaller type everywhere. Touch targets stay 44 px in the mobile drawer.

| Item                     | Pass 03                             | Pass 04                                                           |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------- |
| Sidebar width            | 256 px                              | 224 px                                                            |
| Nav row / font (desktop) | 44 px / 15 px                       | 36 px / 14 px (drawer keeps 44 / 15)                              |
| Top bar                  | 56 px                               | 48 px                                                             |
| Page padding / header    | 36 px top, 40 px sides; 30 px title | 20 px top, 24 px sides; 24 px title                               |
| Overview section gap     | 40 px                               | 16 px                                                             |
| Card padding             | 20 px                               | 16 px                                                             |
| KPIs                     | boxed card, up to 44 px numeral     | one metric strip, up to 30 px numeral                             |
| Trend chart              | 300 px, full width                  | 220 px, beside the mode mix                                       |
| Table rows               | 40 px                               | 32 px                                                             |
| Layout                   | single column                       | 8/4 columns at 1440: trend and hotspots; mix and recent artifacts |

At 1440 x 900 the first viewport now holds the KPI strip, factor caveat, trend,
mode mix, recent artifacts and the start of the hotspot table; before it held the
KPI card and half the trend. The shared section page (Shipments, Suppliers, and
the other routes that use it) took the same page padding, title scale, card
padding (`p-4`) and section spacing. The homepage product glimpse was rebuilt as
the same metric strip, mix bar and leading shipment, rendered with workspace
tokens. Factor provenance, exact values and units, tables, citations, exports,
session and drawer behaviour are untouched.

**Fixes.** The Suppliers search label no longer collides with "Retrieval mode" at
375 px (the label wrapped to a 60 px sliver because its flex basis was 0; it now
takes the full row). The dark first-paint flash is removed by a small inline
script in `<head>` that mirrors `ThemeContext` (saved value, then the system
preference); `scripts/flash.mjs` shows the unhydrated page paints dark.

## Visual comparison and rationale

See `comparison.png` in the pack (Pass 03, Atalanta, Waabi Safety, Pass 04;
palette strip with the historical baseline).

| Reference                                                                     | Adopted                                                                                  | Adapted                                                                                             | Omitted                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Atalanta                                                                      | Olive/paper grounds, rail and spine, light two-tone type, serif copy (kept from Pass 03) |                                                                                                     | Its mark, WebGL, procedural transitions                                                                   |
| Waabi Safety                                                                  | Centred line with a travelling pointer, numbered sections                                | Pointer is the CarbonSage carbon node; sections hold evidence data, not photographs; sage, not pink | Rounded white nav pill, pink accent, video, exact compositions, its licensed typefaces (Zagma, Neue Haas) |
| Waabi home                                                                    | Offset imagery, selective parallax                                                       | Photographs offset against a table of figures; parallax limited to three images                     | Floating tile cloud, full-bleed video                                                                     |
| Dashboard reference 1 (compact metric strip, efficient rows, chart hierarchy) | Metric strip, row density, chart beside the mix                                          | Readable 14 px text and 36 px rows, not tiny type                                                   | Dated styling                                                                                             |
| Dashboard reference 2 (geographic evaluation, neon HUD)                       | Reserved for the later mapped-view pass                                                  |                                                                                                     | HUD styling                                                                                               |
| Historical palette (`#4a4466 #597a64 #4b7480`, `355f92e`)                     | Distinctiveness reference only; its green survives as the sage accent                    |                                                                                                     | Purple and blue-grey                                                                                      |

**Gap:** the two user-supplied dashboard images were attached to the planning
conversation and were not available to this builder; the decisions above follow
the written brief and roadmap descriptions of them. Please confirm against the
images.

## Rights

- **Typefaces:** Archivo (Google Fonts, SIL OFL 1.1) and Newsreader (OFL), both
  loaded through `next/font`; DM Mono (OFL) for workspace figures. The dot-matrix
  "Carbon" is original SVG geometry, not a font. No Waabi, Atalanta or Caveman
  typeface or asset is used.
- **Photographs:** six local files, three public domain/CC0 and three CC BY or CC BY-SA
  (credited in the site footer). Details in `public/media/README.md`. The military
  airlift and the branded road photographs are replaced by a runway and a road
  (infrastructure, not freight vehicles); a permissive commercial freight photograph
  was not found, so licensed stock remains a Pass 06 item.

## Proof

From `nzeroesg-client`:

| Command                                                       | Result                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                           | pass (exit 0)                                                                                                                                                             |
| `npm run lint`                                                | pass (exit 0)                                                                                                                                                             |
| `npm run format:check`                                        | pass (exit 0)                                                                                                                                                             |
| `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run build` | pass                                                                                                                                                                      |
| `npm run test:e2e` (real API, in-memory store)                | 29/29: 11 existing flows, 7 shell (one new: Overview density), 11 public-surface (four new: story static equivalent, pointer follows scroll, lockup naming, theme script) |

Rendered-pixel contrast (`scripts/audit.mjs`): home and `/login`, 1440 px, light
and dark, 386 items, 0 failures; at 375 px, 368 items, 0; all nine workspace
routes at 1440 and 375, light and dark, 3,586 items, 0 active failures (16
disabled controls exempt).

Other: no horizontal overflow in 48 captures (home, `/login`, empty and seeded
Overview, Shipments, Suppliers; light/dark; 1440/768/430/375); 200% zoom (720 px at
2x) has no overflow on home, `/login` and Overview in either theme; focus rings
(2 px sage) are visible on the hero action and workspace navigation in both
themes; the pointer frames (`after/motion/`) show it advancing with the scroll and
the reduced-motion frames show the static equivalent with `data-live` unset and the
pointer hidden.

Public pages, production build, 5 runs, same method as Pass 03:

| Profile                      | LCP              | CLS   | Transfer     | JS           | Images       |
| ---------------------------- | ---------------- | ----- | ------------ | ------------ | ------------ |
| desktop `/`                  | 124 → 176 ms     | 0 → 0 | 565 → 491 KB | 149 → 152 KB | 302 → 222 KB |
| desktop `/login`             | 88 → 76 ms       | 0 → 0 | 300 → 305 KB | 149 → 152 KB | 52 → 52 KB   |
| mobile `/` (4× CPU, slow 4G) | 1,320 → 1,272 ms | 0 → 0 | 306 → 308 KB | 149 → 152 KB | 44 → 39 KB   |
| mobile `/login`              | 768 → 796 ms     | 0 → 0 | 260 → 264 KB | 149 → 152 KB | 11 → 11 KB   |

The baseline was re-measured on `e235e65` and matches Pass 03's 1,328 ms mobile
LCP and 565 KB desktop transfer. Desktop transfer fell because the three
full-bleed mode photographs became small legends and two lazy photographs; the
extra 3 KB of JavaScript is the story and parallax components. Desktop LCP moved
from 124 to 176 ms; mobile LCP, where the hero photograph is still the LCP
element, is flat to slightly better. The 50 ms desktop difference is within this
harness's run-to-run spread on a local server but was not separately investigated.

## Remaining issues and Pass 05 / 06 notes

1. **Hero still dark under its scrim** (planner review): untouched here; Pass 06.
2. **Compact wordmark at 1x:** the 16 px dot-matrix "Carbon" is readable but thin
   on standard-density displays; sharp at 2x and above. A bolder compact cut or a
   larger size is the fix if it reads too faintly in review.
3. **Photography:** the air and road images are infrastructure, not freight;
   attribution is required for three of them (shown in the footer).
4. **Pass 05 page work:** Shipments and Suppliers still carry `rounded-xl` cards,
   chips and shadows (only shared padding changed); Agent, Artifacts, Integrations,
   Report, Scenarios and How to need the same row/density treatment; the Overview
   empty state still reserves 150-220 px placeholders.
5. Shared `body:has(.surface-public)` needs `:has()`; the story and parallax use
   `IntersectionObserver` and `requestAnimationFrame` (all current browsers).
6. Not exercised: screen reader, Safari, Firefox, and printing the new Overview.
7. Reading not done: `docs/demo-roadmap.md`, `carbonsage-ecosystem-vision.md`, the
   Next.js docs beyond the `images.qualities` page, and the OrchestrA `animate`,
   `review-animations` and `design-taste-frontend` skills in full (I read
   `redesign-existing-projects`, part of `break-ui`, and the platform UI rules in
   Pass 03). `nzeroesg-client/AGENTS.md` does not exist on this branch.

## Test it

From the repository root, as in `docs/ui-revamp-workflow.md` (API with the
in-memory store; client on 127.0.0.1):

```bash
git fetch origin design/pass-04-identity-narrative-density
git switch design/pass-04-identity-narrative-density
cd nzeroesg-api && APP_ENV=development DATABASE_URL= EMBEDDING_PROVIDER= ASSISTANT_ENABLED=false CORS_ORIGINS=http://127.0.0.1:3000 ../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
cd nzeroesg-client && NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

(`fetch` works only after the branch is pushed.) Open `http://127.0.0.1:3000/`,
scroll the home page, then **Try the demo → Enter demo workspace → Load demo data**.
Browser checks: `npm run typecheck && npm run lint && npm run format:check && npm run test:e2e`.
