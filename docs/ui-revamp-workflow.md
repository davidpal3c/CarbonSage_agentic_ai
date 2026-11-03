# CarbonSage UI revamp workflow

`design/carbonsage-ui-revamp` is the central integration branch for the UI
revamp. The current roadmap and builder pass are specified in
[`ui-revamp/roadmap.md`](ui-revamp/roadmap.md) and
[`ui-revamp/builder-pass-04.md`](ui-revamp/builder-pass-04.md). The pre-revamp
production baseline is preserved at
`baseline/pre-ui-revamp-2026-11-02`. Production `main` is a separate release
decision.

For every builder design or feature pass:

1. Start the pass branch from the latest `origin/design/carbonsage-ui-revamp`.
2. Push the pass branch immediately, then keep it isolated there while it is
   built. Commit and push checkpoints. A branch that exists only in the
   builder's clone will not appear in the user's original checkout.
3. Fetch the pass branch into the original `nzeroesg app` checkout and verify
   that `git branch` lists it. Switch that clean checkout to the pass branch so
   the user can test locally before integration. Preserve any local changes on
   their own branch before switching.
4. Run the checks relevant to the changed surfaces and review the resulting UI.
   Keep the builder branch available after review so the user can return to it.
5. Merge the reviewed pass into `design/carbonsage-ui-revamp`, then push that
   central branch. Resolve conflicts against the central branch before the
   merge. The next pass starts from the newly integrated tip.

Do not merge the legacy `feature/workspace-bootstrap-contract` snapshot wholesale
into the revamp. Its pending bootstrap work and older UI edits were preserved at
`e4fbd83` for selective review. The production loader measurement file is on
the local-only `archive/local-demo-loader-measurements-2026-11-02` branch and
must not be pushed or merged into a published branch without a separate review.

## Test locally from the original checkout

Use the `nzeroesg app` checkout on `design/carbonsage-ui-revamp`. Its root
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
