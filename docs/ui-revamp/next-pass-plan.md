# UI revamp: next pass direction

Status: completed Pass 03 brief, 2 November 2026. The current roadmap and
builder brief are [`roadmap.md`](roadmap.md) and
[`builder-pass-05.md`](builder-pass-05.md). This supersedes the Evidence Atlas
visual choice and the older instruction to avoid Atalanta's palette and layout.
It does not change the product roadmap or authorize deployment to `main`.

## Current position

- `design/carbonsage-ui-revamp` is the central integration branch. The public
  site, `/login`, workspace shell, and Overview received two Atlas passes.
  Deeper workspace pages largely retain their earlier treatments.
- The current public composition uses a cream canvas, heavy expanded Archivo,
  thick dark rules, mono labels, and illustrated media placeholders. These are
  the main sources of the generic, overdesigned feel reported by the user.
- The pre-revamp palette remains available at
  `baseline/pre-ui-revamp-2026-11-02` (`355f92e`): purple `#4a4466`, green
  `#597a64`, and blue-gray `#4b7480`. Keep this as a distinctiveness reference,
  even if the next pass uses a different palette.
- Freight and transportation suppliers remain the working demo. CarbonSage's
  wider intent is Scope 3 ESG and procurement evidence; other supplier
  categories and a marketplace are future hypotheses, not current features.

## Design direction

**Public site:** Calibrate much closer to [Atalanta](https://www.atalanta.tech/)
first. Study its warm dark and light grounds, quiet light-weight display type,
two-tone headlines, disciplined grid/spine, large whitespace, restrained rules,
and atmospheric imagery. Use these as the primary visual system, with original
CarbonSage copy and original mark/imagery. The current mark may be refined if
it conflicts with the direction. [Waabi](https://waabi.ai/) contributes the
sense of real operations, scale, and selective image motion across transport
modes; it is secondary. Avoid a truck-only identity. The developer's
[Atalanta case study](https://digitalmeadow.studio/projects/atalanta-tech/)
documents its procedural transitions; treat that as later motion research, not
a prerequisite for this pass.

**Workspace:** A calmer enterprise application. Share only the brand anchors
needed for continuity: mark/wordmark, a restrained accent, type family where
legible, and spacing discipline. Use neutral light and dark surfaces, subtle
boundaries, conventional readable controls, and stable dense tables/charts.
Keep cinematic imagery, dark marketing panels, page transitions, and expressive
display treatments out of daily-use workspace screens. Scope public and
workspace tokens so a marketing change cannot recolor data surfaces by accident.

**Entry:** `/login` bridges these modes. It should feel related to the public
site while making the temporary demo action and session terms immediately clear.

## Pass 03: direction reset and calibration

1. Capture current public, `/login`, shell, and Overview screens at desktop and
   mobile sizes. Capture the live references where feasible. Make a short
   comparison sheet showing what will be adopted, adapted, and left out.
2. Rework the public homepage and header around the Atalanta-led hierarchy.
   Keep factual copy and the demo CTA; remove the Atlas-specific graphic
   language. Use a small set of real, locally stored, licensed temporary images
   or video posters so the composition can be judged with representative media.
3. Establish separate public and workspace visual tokens. Recalibrate the
   workspace shell and Overview toward a neutral enterprise look, preserving
   their information hierarchy and every existing workflow. Make the homepage's
   product glimpse accurately reflect this treatment.
4. Reconcile `/login` with the new public/workspace relationship. Keep the
   existing session and route behavior.
5. Present desktop/mobile before-and-after captures and a concise rationale.
   Do not broaden the pass to every workspace page or add WebGL. The visual
   direction is a review gate before the rest of the workspace is restyled.

## Subsequent passes after direction review

- Restyle agent, shipments, suppliers, artifacts, scenarios, integrations, and
  report as enterprise work surfaces. Resolve the known 375px supplier-label
  collision and the light-theme flash noted in the slice-02 review. Preserve
  the agent response renderer, citations, calculations, data store, and print.
- Refine licensed media and purposeful motion on the public site. Add a
  transition or parallax only where it improves the story; verify reduced
  motion, first paint, and responsive performance before considering WebGL.

## Acceptance for pass 03

- Reference comparison and rendered captures at 1440, 768, 430, and 375 px;
  public hero and full page, `/login`, shell, and seeded/empty Overview.
- Atalanta's editorial restraint and image treatment are recognizable on the
  public site. CarbonSage still states the current freight demo honestly and
  retains its own content and mark. The workspace reads as a credible enterprise
  tool rather than a marketing page.
- All routes remain reachable; the demo can be entered and loaded; exact
  figures, chart labels, citations, exports, session controls, keyboard focus,
  responsive layout, and reduced-motion behavior remain intact.
- Check contrast against rendered surfaces and imagery. Record source/licence
  for temporary media, avoid remote hotlinks, and compare page weight and LCP
  with the existing branch before adding motion.
- No API, retrieval, calculation, storage, or roadmap feature changes.

The implementation instructions for Claude Code are in
[`builder-pass-03.md`](builder-pass-03.md).
