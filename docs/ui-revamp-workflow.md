# CarbonSage UI revamp workflow

`design/carbonsage-ui-revamp` is the central integration branch for the Atlas
revamp. The pre-revamp production baseline is preserved at
`baseline/pre-ui-revamp-2026-11-02`. Production `main` is a separate release
decision.

For every builder design or feature pass:

1. Start the pass branch from the latest `origin/design/carbonsage-ui-revamp`.
2. Keep the pass isolated on that branch while it is built and reviewed.
3. Run the checks relevant to the changed surfaces and review the resulting UI.
4. Merge the reviewed pass into `design/carbonsage-ui-revamp`, then push that
   central branch. Resolve conflicts against the central branch before the
   merge. The next pass starts from the newly integrated tip.

Do not merge the legacy `feature/workspace-bootstrap-contract` snapshot wholesale
into Atlas. Its pending bootstrap work and older UI edits were preserved at
`e4fbd83` for selective review. The production loader measurement file is on
the local-only `archive/local-demo-loader-measurements-2026-11-02` branch and
must not be pushed or merged into a published branch without a separate review.

## Test locally from the original checkout

Use the `nzeroesg app` checkout on `design/carbonsage-ui-revamp`. Its root
`.venv` and client `node_modules` are installed. Run these in separate terminals:

```bash
cd "nzeroesg app/nzeroesg-api"
APP_ENV=development DATABASE_URL= EMBEDDING_PROVIDER= ASSISTANT_ENABLED=false CORS_ORIGINS=http://127.0.0.1:3000 ../.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd "nzeroesg app/nzeroesg-client"
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/`, choose **Try the demo**, enter the workspace,
then **Load demo data** on Overview. Use `127.0.0.1` for both services so the
temporary workspace cookie works consistently. This in-memory setup resets
when the API stops; the model-backed assistant is disabled.
