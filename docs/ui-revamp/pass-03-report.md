# Pass 03 report: Atalanta calibration and neutral workspace

Branch `design/pass-03-atalanta-calibration`, from `origin/design/carbonsage-ui-revamp`
at `ecc7aa3`. No API, retrieval, calculation, storage, agent-parsing or roadmap
code changed. At builder handoff it was not pushed; the branch was subsequently
pushed and integrated after review (see `pass-03-planner-review.md`). It has not
been deployed. Review captures, the comparison sheet and
the scripts are in the untracked pack `_workspace/ui-pass-03-review/` (see its README).

## What changed

**Scoped tokens (`app/globals.css`).** The same token names now have two sets.
`:root` / `.dark` is the **workspace** set (neutral off-white and charcoal,
conventional controls, sage as the only accent). `.surface-public` overrides the
names for the homepage and `/login` only (paper `#fcfaf3`, olive `#37352f`).
`.tone-ink` keeps a section dark in both themes; `.surface-workspace` restores the
workspace set inside a public page. The `@theme` block is now `inline`, so
re-declared tokens apply per subtree. A public change can no longer recolour a
table or chart: the e2e spec `public tokens do not reach the workspace...` asserts it.

**Public site.** Header, homepage and `/login` follow Atalanta's relationships: a
fixed-width rail with a hairline spine through every section, section index
labels in the rail, large light-weight two-tone display type (Archivo 300), serif
long-form copy (Newsreader, public-only), olive and paper grounds, full-bleed
photographic bands under dark scrims, square inverted CTAs. The Atlas numbered
trail overlay, heavy expanded type, mono labels, thick rules and illustrated
placeholders are gone. The mark is simplified to a stepped trail (frame removed);
the wordmark is mixed-case.

**Workspace.** Shell and Overview use neutral surfaces, hairline borders, small
radii, sentence-case labels (`.label-ui`) and a sage focus/active accent. Layout,
routes, copy, values and tests are unchanged. The homepage product glimpse is
rendered inside `.surface-workspace`, so it is the real workspace treatment.

**Copy.** Hero, demo path and limits are unchanged in substance; the freight
bands cite only the existing demo-dataset figures (12/18/14/14 shipments; 63.7/
23.8/7.7/4.8%). Nothing claims a supplier network, marketplace or cloud suppliers.

## Comparison: adopted, adapted, omitted

| Atalanta choice                                            | Decision               | Why                                                                                            |
| ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| Warm olive ground `#37352f`, paper `#fcfaf3`               | Adopted                | Primary public ground and light reading surface.                                               |
| Rail + hairline spine, section label in the rail           | Adopted                | Main structural device; collapses to a 56 px rail on phones.                                   |
| 64 px weight-300 two-tone headlines (`#989486` then paper) | Adopted, adapted       | Archivo 300; the quiet tone is used for large text only (3:1), body tones are lighter.         |
| Serif for long-form copy                                   | Adopted, adapted       | Newsreader 400, loaded only on public routes.                                                  |
| Full-bleed dimmed photography with overlaid headline       | Adopted                | Five local photographs; stronger scrims than Atalanta so text passes 4.5:1 on pixels.          |
| Uppercase 12 px labels, `/` nav separators                 | Adopted                | Nav, buttons, index labels.                                                                    |
| Atalanta mark, its WebGL and procedural transitions        | Omitted                | Not ours; motion is later research. No motion was added.                                       |
| Sans body in light-on-dark at 18 px medium                 | Adapted                | Hero paragraph only.                                                                           |
| Sage `#4a6648` / `#aac3a0` accent                          | CarbonSage distinction | From the name; replaces the Atlas clay and teal.                                               |
| Waabi: real operations, multiple modes                     | Adopted (secondary)    | Air, sea, rail, road bands; not truck-only. Its pink accent, floating tiles and video omitted. |
| Old baseline palette `#4a4466 #597a64 #4b7480`             | Historical only        | Not reintroduced; `#597a64` green survives only in spirit as the sage.                         |

## Proof

Run from `nzeroesg-client`:

| Command                                                       | Result                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run typecheck`                                           | pass                                                              |
| `npm run lint`                                                | pass, no issues                                                   |
| `npm run format:check`                                        | pass                                                              |
| `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run build` | pass, 15 routes                                                   |
| `npm run test:e2e` (real API, in-memory store)                | 24/24: 11 existing flows, 6 workspace-shell, 7 new public-surface |

Rendered-pixel contrast (`scripts/audit.mjs`, text hidden, backgrounds
photographed, p10 of samples; 4.5:1, 3:1 large; 3:1 control borders):

| Surface                                             | Items | Active failures                  |
| --------------------------------------------------- | ----- | -------------------------------- |
| Home + `/login`, 1440, light + dark                 | 358   | 0                                |
| Home + `/login`, 375, light + dark                  | 340   | 0                                |
| All nine workspace routes, 1440 + 375, light + dark | 3,630 | 0 (16 disabled controls, exempt) |

The first public run found three real failures (nav slashes 4.04:1, hero note
4.46:1, band lead-in on the sea photo 2.6:1); all fixed and re-audited.

Public pages, production build, 5 runs, same method as earlier slices:

| Profile                      | LCP           | CLS       | Transfer     | JS           | Images      | Fonts       |
| ---------------------------- | ------------- | --------- | ------------ | ------------ | ----------- | ----------- |
| desktop `/`                  | 120 → 128 ms  | 0 → 0     | 308 → 565 KB | 149 → 149 KB | 19 → 302 KB | 106 → 74 KB |
| desktop `/login`             | 76 → 124 ms   | 0 → 0     | 286 → 300 KB | 149 → 149 KB | 8 → 52 KB   | 106 → 74 KB |
| mobile `/` (4× CPU, slow 4G) | 864 → 1328 ms | 0.036 → 0 | 304 → 306 KB | 149 → 149 KB | 15 → 44 KB  | 106 → 74 KB |
| mobile `/login`              | 740 → 768 ms  | 0 → 0     | 286 → 260 KB | 149 → 149 KB | 8 → 11 KB   | 106 → 74 KB |

Other checks: no horizontal overflow in 32 captures (home, `/login`, empty and
seeded Overview, light/dark, 1440/768/430/375); 200% zoom (720 px at 2x) has no
overflow on home, `/login`, Overview in both themes; focus rings (2 px sage) are
visible on the hero CTA and workspace navigation in both themes;
`prefers-reduced-motion` leaves no running animations on the public pages (the
pages have no motion of their own).

## Visual verdict and remaining mismatch

Atalanta's restraint is recognisable on the public site (rail, spine, two-tone
light type, olive and paper, image bands), and the workspace reads as a neutral
enterprise tool. One mismatch to judge: the **hero photograph reads darker and
murkier than Atalanta's** because the scrim is heavy to keep text above 4.5:1.
A photograph with a quiet dark upper third would let the scrim lighten.

## Risks and next pass

1. Photography is temporary (`public/media/README.md`): the air photo is a
   military airlift aircraft, the road photo shows a third-party shipping line's
   markings, and the locations are US/Philippine.
2. Mobile LCP rose from 864 to 1,328 ms on the throttled profile because the hero
   photograph (44 KB at quality 60) is now the LCP element; desktop is flat and CLS
   is 0. Desktop home weight rose 308 → 565 KB with the photographs.
3. Inner workspace routes only inherit tokens (surveyed in both themes, no
   overflow, contrast audit clean). Still to restyle: mono small-caps eyebrows
   (Artifacts, Agent usage panel), `rounded-xl` cards with shadows on Shipments/
   Suppliers/Report, the 375 px Suppliers label collision, and the agent page
   layout. Dark-mode first-paint flash remains (a head script would fix it).
4. `body:has(.surface-public)` needs `:has()` (all current browsers); older ones
   keep the workspace body background behind the public page.
5. Not exercised: screen reader, Safari, Firefox, print of the new Overview.
6. Briefed reading not done: `docs/demo-roadmap.md`, `carbonsage-ecosystem-vision.md`
   and the Next.js docs beyond the `images.qualities` page (the existing copy and
   build behaviour were preserved instead); `nzeroesg-client/AGENTS.md` does not
   exist in this branch. OrchestrA skills read: `redesign-existing-projects`,
   the first part of `break-ui`, and `platform-ui-working-rules.md`; no motion was
   added, so the animation skills were not used, and the `break-ui` worst-case
   data pass was not run.
