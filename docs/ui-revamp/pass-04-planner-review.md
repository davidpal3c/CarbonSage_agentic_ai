# Pass 04 planner review

Reviewed 3 November 2026. Builder branch
`design/pass-04-identity-narrative-density` began at central commit `e235e65`
and delivered `180d771`. The builder clone could not publish its branch, so I
imported the commit into the original `nzeroesg app` repository, switched that
checkout to the pass branch, and pushed it before review. The original checkout
is now the sole working repository for builder and planner passes.

## Verdict

Accept Pass 04 for `design/carbonsage-ui-revamp`. Its mark and dot-matrix
wordmark are original, the homepage has a purposeful evidence story and varied
photo compositions, and the shell/Overview show materially more information in
the first desktop viewport. The workspace stays neutral and legible. The
builder's comparison, captures, asset provenance, and measured performance are
in [`pass-04-report.md`](pass-04-report.md) and the local review pack
`_workspace/ui-pass-04-review/`.

## Review corrections

I committed `777d387` on the pass branch before integration:

- Target only story steps when calculating the active step; decorative line
  elements are not content steps.
- Respond when the system's reduced-motion preference changes while the page
  is open, and cancel queued animation frames on cleanup. The parallax resets
  to its static image position.
- Increase dot weight in the compact “Carbon” wordmark at standard pixel
  density; retain the same geometry and naming.
- Apply system dark preference even if local storage access fails during the
  first-paint theme script; remove a stale Atlas test comment.

## Independent proof

- `git diff --check`: passed.
- Installed lockfile dependencies in the original checkout (`npm ci --offline`);
  installed Next.js is now `16.4.3`, matching the lockfile. No package files
  changed.
- Client typecheck, lint, and format check: passed.
- Production client build with `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000`:
  passed, 15 generated routes. Font fetching required network access after the
  sandboxed build could not resolve Google Fonts.
- Focused Playwright on the built client: 3/3 passed for initial reduced motion,
  scroll pointer progress, and changing reduced-motion preference at runtime.
  I did not restart the API for the builder's 29/29 workspace flows; those
  results are in the builder report.
- Reviewed the public, lockup, motion, and desktop/mobile workspace captures.
  The first 1440×900 Overview viewport now contains metrics, trend, mix,
  recent artifacts, and the beginning of hotspots. The 375 px Overview remains
  readable without horizontal overflow in the builder's capture set.

## Remaining visual and release work

The compact wordmark should be judged by the user at 1x on their screen. The
hero remains dark under its scrim. Air and road images now show infrastructure
and landscape rather than commercial freight vehicles. Inner workspace pages
still have larger cards, shadows, and inconsistent row rhythm. Safari,
Firefox, screen reader, and print review remain for the later release pass.

Pass 04 was fast-forwarded into `design/carbonsage-ui-revamp`. Production
`main` was not changed.

I removed the old Pass 04 planning worktree and the three previous builder
clones after verifying that their branch commits were present in the original
repository or refreshed remote refs. `git worktree list` now shows only the
original checkout; `_workspace` contains review artifacts, not Git checkouts.
