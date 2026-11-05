# Claude Code builder prompt — Pass 06

You are the implementation builder; Codex plans, reviews, and integrates. Read
`docs/ui-revamp/pass-06-plan.md`, `docs/ui-revamp/roadmap.md`,
`docs/ui-revamp/pass-05-planner-review.md`, `docs/ui-revamp-workflow.md`,
`docs/carbonsage-ecosystem-vision.md`, and applicable `AGENTS.md` before work.
The user has approved the Pass 05 sizing change. The new work is requested in
this pass.

## Single-repository branch workflow

Work only in `/Users/user/Projects/agentic ai - workflow project/nzeroesg/nzeroesg app`.
Never clone or create a worktree. Start from the latest
`design/carbonsage-ui-revamp` after confirming a clean working tree. Create
and **check out** `design/pass-06-guided-decisions-report` in this original
checkout before editing, then push the new branch immediately if permitted.
Report the branch, base SHA, and `git status --short --branch` to the user and
Codex before implementation. Commit and push coherent checkpoints so the user
can test the exact original checkout while you build. If a push is denied,
continue locally on this branch and report it; do not switch repositories.
Leave the final clean checkout on your pass branch for review. Do not merge,
deploy, or change `dev`/`main`; Codex will integrate after review.

## Implementation

Trace the current behavior and invariants in the cited files first. Solve the
five items in `pass-06-plan.md` at their owning layers. Keep the Pass 05 lean
enterprise workspace and the Atalanta-led public language. Use the actual
typed report and workspace principal for PDF, and vector or otherwise crisp
charts that paginate reliably. Add an accessible Export menu with PDF and CSV;
remove the Print button. Remove the homepage theme toggle on desktop/mobile;
make the public surface light independently of the saved workspace theme, and
add `David P.` in the footer linking to `https://davidpalacios.dev`.

For broad supplier questions, treat missing route/weight as a conversation
state that can be narrowed using current workspace lanes, not a universal
ranking. Add the smallest fitting typed tool or service capability, update
planner policy and composer, and cover deterministic fallback and follow-up
turns. Preserve exact-lane recommendation, citations, disclosure boundaries,
and no-data handling. Do not claim live availability or quote validity.

Reproduce the chat gap in rendered UI before adjusting CSS; identify whether
it is inside the panel or shell padding and which states trigger it. Fix the
layout root cause without making the input float over messages. Check desktop,
375/430/768 px, launcher and embedded Agent, before/after answers, tall input,
and 200% zoom.

## Review evidence and handoff

Run the smallest meaningful tests for changed behavior: backend API/agent
tests, frontend typecheck/lint/format/build, and targeted browser flows. Inspect
the downloaded PDF pages visually, compare key values with report preview,
and inspect home/chat captures in both theme preferences. Place temporary
captures under `_workspace/ui-pass-06-review/` outside the Git repo. Write a
short `docs/ui-revamp/pass-06-report.md` with approach, exact commands/results,
PDF sample findings, UI evidence, dependency choice, limitations, and local
test steps. Commit the report with the code. Provide the final SHA and branch
status. Keep the original checkout on the pass branch and clean.
