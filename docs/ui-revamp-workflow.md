# CarbonSage UI revamp workflow

`design/carbonsage-ui-revamp` is the central integration branch for the UI
revamp. The current roadmap and builder pass are specified in
[`ui-revamp/roadmap.md`](ui-revamp/roadmap.md) and
[`ui-revamp/builder-pass-05.md`](ui-revamp/builder-pass-05.md). The pre-revamp
production baseline is preserved at
`baseline/pre-ui-revamp-2026-11-02`. Production `main` is a separate release
decision.

For every builder design or feature pass, use only the original `nzeroesg app`
repository. Do not make a clone or worktree. The builder and user share its
current checkout, so the user can test the builder branch without a fetch or
checkout handoff.

1. Confirm the original checkout is clean on the latest
   `design/carbonsage-ui-revamp`. Preserve unexpected local changes on their
   owning branch before switching.
2. Create and switch to the named pass branch in this checkout. Publish it
   immediately if permitted, and tell the user its name and base SHA. A remote
   publishing restriction does not prevent local testing in this checkout.
3. Commit coherent checkpoints and keep the checkout on the pass branch while
   building and testing. Share a ready checkpoint with the user before review.
4. Run relevant checks and review rendered UI. Commit and push the final pass
   branch if permitted; leave the original checkout on it for user testing.
5. Codex reviews and fixes the pass on that branch, then fast-forwards it into
   `design/carbonsage-ui-revamp`, pushes central, and leaves the same original
   checkout on central. The next pass starts from that new tip.

Do not merge the legacy `feature/workspace-bootstrap-contract` snapshot wholesale
into the revamp. Its pending bootstrap work and older UI edits were preserved at
`e4fbd83` for selective review. The production loader measurement file is on
the local-only `archive/local-demo-loader-measurements-2026-11-02` branch and
must not be pushed or merged into a published branch without a separate review.

## Test locally from the original checkout

Use the `nzeroesg app` checkout on the current pass branch during a builder
pass, or on `design/carbonsage-ui-revamp` after integration. Its root
`.venv` and client `node_modules` are installed. From the repository root, run
these in separate terminals:

```bash
cd nzeroesg-api
APP_ENV=development DATABASE_URL= EMBEDDING_PROVIDER= ASSISTANT_ENABLED=false CORS_ORIGINS=http://127.0.0.1:3000 ../.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd nzeroesg-client
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/`, choose **Try the demo**, enter the workspace,
then **Load demo data** on Overview. Use `127.0.0.1` for both services so the
temporary workspace cookie works consistently. This in-memory setup resets
when the API stops; the model-backed assistant is disabled.
