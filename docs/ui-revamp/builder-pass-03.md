# Claude Code builder prompt — pass 03

You are the implementation builder for CarbonSage's UI revamp. Codex plans,
reviews, and integrates your pass. The user rejected the Evidence Atlas visual
direction after trying it locally. Their latest direction is to bring the
**public site much closer to Atalanta's brand system first**, with Waabi as a
secondary reference for cinematic real-world movement. The **dashboard must
remain more neutral and enterprise looking** than the landing site. Treat this
prompt and `next-pass-plan.md` as superseding the earlier Atlas briefs.

## Start and references

1. Work in a clean isolated checkout. Fetch and branch from the latest
   `origin/design/carbonsage-ui-revamp`, naming your branch
   `design/pass-03-atalanta-calibration`. Verify the base and clean status.
   Do not start from `main`, modify another checkout, or merge to `main`.
2. Read `docs/ui-revamp/next-pass-plan.md`, `docs/ui-revamp-workflow.md`,
   `docs/demo-roadmap.md`, `docs/carbonsage-ecosystem-vision.md`,
   `nzeroesg-client/AGENTS.md`, the current public/workspace components and CSS,
   and the relevant installed Next.js 16 guidance under
   `nzeroesg-client/node_modules/next/dist/docs/` before editing.
3. Inspect the live [Atalanta](https://www.atalanta.tech/) and
   [Waabi](https://waabi.ai/) sites at desktop and mobile sizes. If live capture
   fails, record the failure and use available captures plus the
   [Atalanta developer case study](https://digitalmeadow.studio/projects/atalanta-tech/)
   and [design analysis](https://dokle.design/websites/atalanta-deep-tech-website-design-no-pure-black).
   Begin the visual study near Atalanta's reported warm olive `#37352f`, paper
   `#fcfaf3`, and warm muted tones `#989486` / `#d0cec8`. Match its visual
   relationships and pacing before adding CarbonSage distinctions. Keep
   CarbonSage's own copy and licensed imagery. You may refine its current mark;
   do not reproduce Atalanta's mark or spend the pass on a separate logo study.
4. Use the OrchestrA project for **method**, especially
   `/Users/user/Documents/OrchestrA/Landing_site/orchestra-landing-site/.agents/skills/redesign-existing-projects/SKILL.md`,
   `design-taste-frontend/SKILL.md`, `break-ui/SKILL.md`, and, if you add motion,
   `animate/SKILL.md` and `review-animations/SKILL.md` in that same directory.
   Read `/Users/user/Documents/OrchestrA/Landing_site/_workspace/platform/platform-ui-working-rules.md`
   for its marketing-versus-working-tool and rendered-pixel lessons. Apply
   relevant methods, not OrchestrA's design tokens, stack, or instructions for
   its separate repository. Inspect any other installed Claude design skills
   that genuinely help and briefly record what you used.

## Scope of this pass

**Public site and header:** Recompose `/` around an Atalanta-like editorial
hierarchy: large but quiet light-weight type, two-tone emphasis, dark warm and
light reading surfaces, generous whitespace, a consistent grid/spine,
restrained boundaries, and atmospheric real imagery. The current split hero,
bold expanded type, numbered trail overlay, dense mono labels, and illustrated
fallbacks are candidates for replacement. Preserve the clear **Try the demo**
path, accurate current feature claims, and the distinction between general
Scope 3 intent and today's freight/transportation supplier demo. The current
demo spans air, sea, rail, and road. Do not present cloud suppliers, a supplier
network, or a marketplace as live capabilities.

**Representative media:** Use a few compelling locally stored temporary
photographs or posters with recorded sources and licenses; optimize them for
responsive delivery. Combine environmental and industrial context with more
than one transport mode. Design text-safe crops and scrims. Do not hotlink
remote media or use Atalanta/Waabi's own assets. Static composition takes
priority over WebGL or cinematic effects. Keep a still fallback if motion is
added.

**Enterprise workspace calibration:** Rework shared styling ownership so
public changes do not automatically restyle application data surfaces. Adjust
the workspace shell and Overview to a neutral, professional light/dark system:
quiet off-white/gray surfaces, charcoal text, subtle separators, clear controls,
stable chart colors and readable density. Share the mark, limited accent, and
typographic discipline with the public site; avoid marketing panels,
atmospheric images, dramatic transitions, and oversized display headings in
the dashboard. Update the homepage product glimpse to reflect the actual
workspace treatment. Reconcile `/login` as a clear bridge between the two.

Preserve all workspace routes, demo seeding, state hydration, API contracts,
exact values and units, charts and tables, citations, exports, session and
sign-out behavior, keyboard access, and report print. Do not redesign every
inner workspace page in this pass. Survey them for shared-token regressions and
record what the following pass needs to address. Do not change API, retrieval,
calculation, storage, or agent response parsing logic.

## Deliverables and proof

1. A concise comparison sheet: current Atlas versus Atalanta reference versus
   the proposed CarbonSage result. Include the old palette as a historical
   comparator from `baseline/pre-ui-revamp-2026-11-02` (`#4a4466`, `#597a64`,
   `#4b7480`), without assuming it must return in this pass. Identify which
   choices were adopted, adapted, or omitted and why.
2. Implemented public homepage/header, `/login`, scoped visual tokens, neutral
   shell/Overview calibration, and representative media with source/licence
   notes. Keep the change coherent and avoid new UI dependencies unless the
   existing platform cannot implement a required behavior cleanly.
3. Before/after rendered captures at 1440, 768, 430, and 375 px. Show the
   public first viewport and full page, `/login`, and empty/seeded Overview in
   light and dark modes. Inspect actual pixels for text contrast, image crops,
   200% text, focus indicators, and horizontal overflow.
4. Verify primary CTA and demo-entry behavior, mobile navigation, every
   workspace destination, demo load, chart/table readability, keyboard flow,
   and `prefers-reduced-motion`. Run `npm run typecheck`, `npm run lint`,
   `npm run format:check`, `npm run build`, and the relevant Playwright checks
   from `nzeroesg-client`; report exact commands and results. Measure or report
   comparable LCP/page-weight indicators before and after media changes.
5. Report files changed, visual rationale, asset licenses, screenshots,
   measurements, and remaining risks. Commit only on your pass branch after
   checks. Leave it for Codex/user visual review; Codex will integrate the
   reviewed pass into `design/carbonsage-ui-revamp` and push that central branch.
   Do not deploy.

The acceptance question is visual as well as functional: **Does the public
site now feel close to Atalanta's restraint and image-led authority while the
dashboard feels like a credible enterprise tool belonging to CarbonSage?**
If the answer is uncertain, show captures and the specific mismatch before
adding more styling or motion.
