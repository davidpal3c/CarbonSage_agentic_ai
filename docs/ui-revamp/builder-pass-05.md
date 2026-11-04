# Claude Code builder prompt — Pass 05

You are the CarbonSage UI implementation builder. Codex plans, reviews, and
integrates your pass. Pass 04 is on `design/carbonsage-ui-revamp`; the user's
next priority is a consistently lean, neutral, professional dashboard across
all remaining work surfaces. Read [`pass-05-plan.md`](pass-05-plan.md) and
[`roadmap.md`](roadmap.md) before editing.

## Git and checkout rules — use the original repository only

1. Work **only** in
   `/Users/user/Projects/agentic ai - workflow project/nzeroesg/nzeroesg app`.
   Do not clone the repository, create a worktree, or edit a second checkout.
   Confirm `git status --short --branch` is clean and the central branch is at
   the expected latest tip. If there are unexpected changes, identify and
   preserve them on their owning branch before switching; never discard them.
2. From the latest `design/carbonsage-ui-revamp`, create and switch this same
   original checkout to `design/pass-05-enterprise-surfaces`. Push the branch
   immediately if permitted. Give the user and Codex the branch name, base
   SHA, and `git status --short --branch` output **before implementation**.
   The user can then test in the original checkout at every committed
   checkpoint without fetching or switching to a branch held elsewhere.
3. Commit coherent checkpoints on that pass branch and push each one if
   permitted. If publishing is denied by the environment, keep working in the
   original checkout and report the denial promptly; Codex can publish the
   already visible local branch. Leave the checkout on the completed pass
   branch for review. Do not merge to central, switch to `main`, or deploy.
4. Put screenshots and temporary review files in
   `/Users/user/Projects/agentic ai - workflow project/nzeroesg/_workspace/ui-pass-05-review/`.
   This is an artifact folder, not a Git checkout.

## Study and method

- Read `docs/ui-revamp/pass-04-planner-review.md`,
  `docs/ui-revamp/pass-04-report.md`, `docs/ui-revamp/pass-05-plan.md`,
  `docs/ui-revamp-workflow.md`, `docs/demo-roadmap.md`,
  `docs/carbonsage-ecosystem-vision.md`, and `nzeroesg-client/AGENTS.md`.
  Inspect each current workspace route, its shared components and styles,
  and the relevant installed Next.js 16 docs in
  `nzeroesg-client/node_modules/next/dist/docs/`.
- Use the user's first dashboard reference for efficient information hierarchy
  and chart/card density. Keep CarbonSage's neutral workspace tone and clear
  14 px text rather than copying that reference's small labels or styling.
  The second map reference belongs to a later trajectory evaluation pass.
- Apply relevant OrchestrA methods from
  `/Users/user/Documents/OrchestrA/Landing_site/orchestra-landing-site/.agents/skills/`
  (`redesign-existing-projects`, `design-taste-frontend`, `break-ui`) and
  `/Users/user/Documents/OrchestrA/Landing_site/_workspace/platform/platform-ui-working-rules.md`.
  Read the referenced material before using it; record which methods informed
  decisions. Preserve CarbonSage's own product content and tokens.

## Build scope

1. Survey Agent, Shipments, Suppliers/Evidence, Artifacts, Scenarios,
   Integrations, Report, and How to in light/dark at 1440, 768, 430, and
   375 px. Record the concrete causes of visual bloat: oversized page titles,
   repeated `rounded-xl` cards, shadows, roomy table rows, chips, large empty
   states, chart proportions, and form spacing. Check Overview and the shell
   for consistency. Make a concise page-by-page decision list.
2. Consolidate fitting shared workspace presentation patterns in their
   responsible components or scoped styles. Carry Pass 04's compact hierarchy
   across the pages while preserving task-specific space. Avoid a global scale
   transform, tiny body text, and selectors that recolor public surfaces.
3. Refine the agent page as a reading and decision surface. Keep structured
   answers, citations, recoverable source locations, metrics, tables, charts,
   warnings, tool activity, and suggested actions readable and operable. Keep
   the launcher/embedded behavior and session controls.
4. Refine shipment analytics, supplier evidence search/results, scenario
   comparison, artifact catalog/viewer, integration cards, report/export, and
   How to. Keep the first desktop viewport useful, and handle long names,
   exact numbers, validation and loading/error states, and narrow screens.
5. Recheck the 375 px Suppliers label, dark-theme first paint, 200% zoom,
   keyboard focus, mobile drawer, and report print. Keep the homepage product
   glimpse aligned with the real workspace only if these changes affect it.

## Invariants and proof

Preserve all routes, demo loading, data state, API contracts, calculations,
factor provenance, citations, retrieval semantics, artifact actions, imports,
exports, agent responses, report print, navigation, session behavior, and
accessibility. No API, storage, model, or product capability expansion. No
map view in this pass.

Deliver before/after captures for every major page at 1440 and 375 px, plus
representative 768/430 px and light/dark states. Inspect actual pixels for
density, contrast, focus, overflow, long content, error and empty states, and
200% zoom. Run typecheck, lint, format check, build, and relevant Playwright
flows with the real local in-memory API; report exact commands/results. Include
manual checks of source/citation and report print behavior. Explain any
bundle or performance change if new dependencies are introduced.

Commit the complete result on `design/pass-05-enterprise-surfaces`, push if
permitted, and send the exact SHA plus test instructions. The original checkout
must remain on that pass branch with a clean working tree so the user can test
immediately. Codex will review, fix material issues, fast-forward the central
branch, and leave that same checkout on central for the next pass.
