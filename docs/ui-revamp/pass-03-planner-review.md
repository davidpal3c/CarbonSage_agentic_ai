# Pass 03 planner review

Reviewed 2 November 2026. Builder commit `a1855e4` was created on
`design/pass-03-atalanta-calibration` from central revamp commit `ecc7aa3`.
The builder branch was fetched into the original checkout and pushed to origin
before this review, so it was available for local testing. The full builder
report is [`pass-03-report.md`](pass-03-report.md); rendered captures and a
comparison sheet are in `_workspace/ui-pass-03-review/` in the shared local
project folder.

## Verdict

Accept the pass for the central revamp branch. The public site now follows the
requested Atalanta-led hierarchy: warm olive and paper grounds, a consistent
spine, quiet two-tone type, large spacing, and real, locally stored images.
The workspace shell and Overview use separate neutral tokens and preserve a
more conventional enterprise treatment. `/login` bridges the two. The diff is
limited to the client, public media, its tests, and documentation; it does not
alter API contracts, calculations, retrieval, or workspace state.

I inspected the builder's comparison sheet; public desktop and phone captures;
light and dark Overview captures; public and workspace token ownership; header,
media, login, and Overview changes; the temporary-media provenance; and the
new browser checks. The pass branch was clean at `a1855e4` and fast-forwarded
into `design/carbonsage-ui-revamp` without a conflict.

## Verification

- Independently ran client typecheck, lint, and format check: passed.
- Independently built the client with the lockfile's Next.js `16.4.3`: passed,
  15 generated routes. An earlier build in the original checkout used its
  stale installed Next.js `16.3.0`; that also passed but is not the release
  version. The first build attempt without network access failed while fetching
  Google fonts; retry with font access passed.
- `git diff --check ecc7aa3..a1855e4`: passed.
- Builder reports 24/24 Playwright flows, zero horizontal overflow in 32
  captures, and zero active failures in its rendered contrast audit. Those
  browser checks were not independently rerun during this review.

## Follow-up before a production release

- The hero image is darker than the Atalanta reference under the scrim. Source
  a photograph with a quieter upper field so the image can carry less overlay
  while text remains readable.
- Replace the temporary military airlift and visibly branded road photographs
  with representative commercial images. Sources and claimed public-domain
  licences are recorded in `nzeroesg-client/public/media/README.md`.
- The builder's throttled mobile LCP measurement rose from 864 to 1,328 ms;
  desktop homepage transfer rose from 308 to 565 KB. Keep media weight and
  first paint in view during the next visual pass.
- Inner workspace pages still need enterprise restyling. The 375 px Suppliers
  label collision and first-paint dark-theme flash remain. Screen-reader,
  Safari, Firefox, and new Overview print output were not exercised here.

Production `main` and deployment remain separate decisions.
