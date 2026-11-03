# Claude Code builder prompt — Pass 04

You are the implementation builder for CarbonSage's UI revamp. Codex plans,
reviews, and integrates your pass. The user likes the Pass 03 Atalanta-led
foundation, and now asks for a distinctive CarbonSage identity, selective
Waabi-like scroll storytelling, and a leaner enterprise dashboard. Use
[`roadmap.md`](roadmap.md) as the current scope and sequence.

## Branch visibility and handoff

1. Work in your own clean isolated checkout. Fetch the latest
   `origin/design/carbonsage-ui-revamp`; create
   `design/pass-04-identity-narrative-density` from that exact tip. Do not
   work in the user's original `nzeroesg app` checkout or branch from `main`.
2. **Push the pass branch immediately, before editing.** Send Codex the branch
   name, base SHA, remote ref, and fetch/test commands. Previous builder work
   could not be tested because its branch was not available in the user's
   checkout. Keep pushing coherent checkpoints so this branch stays testable.
3. Leave the final branch pushed for user testing and Codex review. Do not
   merge to the central branch or deploy. Codex will integrate it after review.

## Read and study first

- Read `docs/ui-revamp/roadmap.md`, `docs/ui-revamp-workflow.md`,
  `docs/ui-revamp/pass-03-planner-review.md`, `docs/demo-roadmap.md`,
  `docs/carbonsage-ecosystem-vision.md`, `nzeroesg-client/AGENTS.md`, and
  the current public, brand, shell, Overview, chart, Shipments, and Suppliers
  components. Follow relevant installed Next.js 16 documentation in
  `nzeroesg-client/node_modules/next/dist/docs/` before coding.
- Inspect `https://www.atalanta.tech/`, `https://waabi.ai/`, and
  `https://waabi.ai/safety` at desktop and mobile. The requested Waabi
  reference is the Safety page's centered pointer advancing through numbered
  story sections, plus the homepage's offset imagery and parallax. Record
  adopted, adapted, and omitted choices. Do not reuse source code, brand
  assets, exact compositions, or fonts without rights.
- Apply relevant methods from OrchestrA's
  `/Users/user/Documents/OrchestrA/Landing_site/orchestra-landing-site/.agents/skills/`
  (`redesign-existing-projects`, `design-taste-frontend`, `break-ui`, `animate`,
  `review-animations`) and
  `/Users/user/Documents/OrchestrA/Landing_site/_workspace/platform/platform-ui-working-rules.md`.
  These are methods, not design tokens or instructions for this repository.

## Build scope

### Identity

Create an original, simple CO₂-inspired symbol with three nodes and two bonds;
avoid glossy molecule rendering. Explore how one line or node can echo the
public site's evidence trajectory. Set “Carbon” in a legible dot-matrix/pixel
treatment like the user's Caveman wordmark image, and “Sage” in a restrained
grotesque with a Waabi-like role. Waabi's exact typefaces may require licenses;
use a licensed/open alternative unless rights are established. Provide large,
compact, and mark-only lockups. Check small-size rendering, light/dark surfaces,
and accessible naming. Keep the workspace lockup quiet and compact.

### Public narrative and media

Preserve Pass 03's Atalanta-led olive/paper base, rail/spine, whitespace, and
editorial restraint. Replace the repeated full-width transport image bands
with a varied but coherent sequence: an offset photo/text section, an
overlapping editorial panel, and one centered scroll narrative. Use that
narrative to trace operational input → deterministic calculation → cited
supplier evidence → decision. The current demo is freight and transport
suppliers across air, road, sea, and rail; wider Scope 3 categories and a
marketplace are future ideas, not live features. Keep the demo CTA direct.

Use locally stored, licensed stock imagery or still posters spanning
transport, industrial operations, nature, and environment. Replace the
temporary military and branded road photos where suitable alternatives are
available; document source and license in `public/media/README.md`. Optimize
responsive delivery and text-safe crops. Add restrained parallax only to
selected imagery and make the pointer move with scroll progress. Prefer
existing CSS/browser APIs and current dependencies. Keep motion bounded,
smooth, and responsive, with a static `prefers-reduced-motion` equivalent
that preserves content and reading order. Do not delay critical copy or the
CTA. WebGL is not necessary for this pass.

### Lean enterprise workspace

Use the user's first dashboard image for compact structure and hierarchy,
without adopting tiny text or dated styling. Make the shell and empty/seeded
Overview meaningfully leaner: sidebar row/width and group spacing, page
header scale, card padding and borders, KPI rhythm, chart footprint, table
rows, and empty states. Current review points: 256 px sidebar, 44 px nav rows,
40 px Overview section gaps, 20 px card padding, a 300 px trend chart, and
large KPI numerals. Treat these as evidence, not mandatory target values.
Aim to show more useful Overview information in the first 1440×900 viewport.
Keep legible text, usable targets, focus, contrast, 200% zoom, responsive
layout, and light/dark parity. Do not apply a global scale transform or
shrink all type uniformly.

Survey Shipments and Suppliers and update shared density patterns where
needed; record page-specific work for Pass 05. Keep public imagery and
cinematic movement out of daily-use data surfaces. Make the homepage product
glimpse accurately reflect the revised workspace.

## Invariants and acceptance proof

Preserve routes, demo entry/load, workspace state, API contracts, exact
figures and units, factor provenance, charts/tables, citations, exports,
report print, session/sign-out, keyboard, and drawer behavior. No API,
retrieval, calculation, storage, or agent-response logic changes.

Deliver:

1. A short visual comparison/rationale for Atalanta, Waabi, both user-supplied
   dashboard images, and the historical CarbonSage palette on
   `baseline/pre-ui-revamp-2026-11-02`.
2. Before/after captures at 1440, 768, 430, and 375 px: public first viewport
   and full page, lockup variants, `/login`, empty/seeded Overview in light
   and dark, and representative Shipments and Suppliers. Show a short motion
   capture or frame sequence plus the reduced-motion equivalent.
3. Pixel review for contrast, crops, charts, focus, overflow, and 200% zoom.
   Check the 375 px Suppliers label collision and dark-theme first-paint flash;
   fix them if shared changes touch their cause, otherwise record for Pass 05.
4. Run client typecheck, lint, format check, build, and relevant Playwright
   flows with the real local in-memory API. Report exact commands and results.
   Measure homepage LCP and transfer before/after, including throttled mobile;
   compare with Pass 03's 1,328 ms mobile LCP and 565 KB desktop transfer.
   Explain any regression.
5. Commit and push the final branch. Report changed files, font/media rights,
   visual decisions, captures, measurements, remaining issues, and exact
   branch/SHA and commands for local testing. Wait for review before central
   integration; do not deploy.

Visual acceptance: the public site reads as an original CarbonSage brand on
an Atalanta-like restrained foundation, with one purposeful Waabi-inspired
evidence journey. The workspace shows materially more decision-useful data at
a glance while remaining calm, legible, and professional.
