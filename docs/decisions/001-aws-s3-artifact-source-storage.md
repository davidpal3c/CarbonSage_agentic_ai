# Decision 001: AWS S3 artifact source storage

- **Status:** Accepted; implemented behind explicit runtime activation
- **Decision date:** August 9, 2026
- **Scope:** CarbonSage initial demo workspaces
- **Review trigger:** Any retention beyond 24 hours, direct browser-to-S3 transfer,
  a second AWS region, files larger than 10 MB, background processing, or a
  projected S3 charge above USD $0.50 per month

## Decision

CarbonSage will retain validated shipment CSV and supplier-evidence source files
in one private Amazon S3 Standard bucket in `ca-central-1`. Retention is bounded
by the earlier of the workspace expiry and 24 hours. Generated report snapshots,
normalized shipments, extracted evidence, chunks, embeddings, citations, and
artifact catalog records remain in PostgreSQL.

The FastAPI modular monolith owns every upload, download, authorization check,
quota reservation, and delete request. The browser never receives AWS
credentials or a reusable S3 URL. S3 is an external blob boundary, not a new
application service or source of domain truth.

This decision supersedes the earlier temporary-upload assumption. It does not
create an indefinite document repository: retained bytes are a short-lived,
private convenience for exact-source recovery, provenance inspection, and
future reprocessing.

## Why S3

The alternatives were technically viable, but S3 gives this project the best
balance of architecture, learning value, and future portability:

- it demonstrates the canonical object-storage API, scoped IAM, lifecycle
  management, server-side encryption, and provider-aware cost controls;
- it is a credible deployment boundary for a future hosted product without
  requiring MinIO operations or another application platform;
- the source-file volume is so small that ordinary paid pricing is measurable
  in cents rather than dollars;
- the application contract remains provider-neutral enough to replace the
  object-store adapter later without changing artifact or ingestion domains.

Cloudflare R2 and Backblaze B2 offered stronger recurring free allowances.
They remain reasonable future cost alternatives, but maximizing free-tier
capacity is not the only objective. AWS experience and its mature IAM/lifecycle
model are valuable parts of the implementation proof. MinIO on free Render was
rejected because free Render filesystems are ephemeral and persistent disks
require a paid service; operating a single-node object store would add more
failure modes than value.

## Exact storage boundary

Stored source objects use opaque identifiers and content identity rather than
user-controlled filenames:

```text
workspaces/{workspace_id}/artifacts/{artifact_id}/v{version}/{sha256}
```

PostgreSQL migration `006_artifact_object_storage.sql` records:

- workspace and artifact identity;
- provider, bucket alias, and object key;
- content type, byte size, SHA-256 digest, and S3 ETag;
- reservation, ready, delete-pending, deleted, or failed status;
- creation, storage, expiry, and deletion timestamps;
- global active/reserved bytes and monthly request/egress counters.

The object metadata deliberately has no foreign key to an expiring workspace.
That allows a deletion tombstone to survive PostgreSQL workspace cleanup until
the S3 delete succeeds or the bucket lifecycle rule removes the object.

Steady-state workspace storage is at most approximately 42 MB: one 10 MiB
shipment source and three 10 MiB evidence sources. The configured 55,000,000
byte workspace limit allows a new maximum-size shipment to be retained before
the previous shipment is deleted, preserving a safe replacement sequence.

## Cost ceiling and circuit breaker

The approved S3 service ceiling is **USD $0.50 per calendar month before tax**.
It does not include exchange-rate conversion, unrelated AWS services, or
out-of-band bucket activity by an administrator.

The application uses the August 2026 S3 Standard rates for Canada Central:

| Cost dimension | Rate used by policy |
| --- | ---: |
| Storage | $0.025 per GB-month |
| PUT, COPY, POST, or LIST | $0.0055 per 1,000 requests |
| GET, HEAD, and other reads | $0.0044 per 10,000 requests |
| Internet egress safety rate | $0.09 per GB |

The egress calculation deliberately ignores AWS's recurring first 100 GB of
account-wide internet transfer at no charge. Promotional credits and Free Tier
storage/request allowances are also ignored. The breaker therefore remains
conservative if those benefits change or are consumed by another workload.

Hard limits are:

| Dimension | Application stop | Maximum priced contribution |
| --- | ---: | ---: |
| Active plus reserved storage | 4,000,000,000 bytes | $0.100 |
| Write-class requests | 10,000/month | $0.055 |
| Read-class requests | 100,000/month | $0.044 |
| Download egress | 2,000,000,000 bytes/month | $0.180 |
| **Estimated maximum** |  | **$0.379** |

The remaining approximately $0.121 is safety margin for small pricing changes
and estimation error. Configured limits are validated at API startup; a limit
set that reaches the $0.50 ceiling is rejected. The AWS SDK is configured for
one total attempt per operation so automatic retries cannot multiply billable
requests outside the ledger.

The breaker is transactional and shared across API instances in PostgreSQL:

1. Lock the global state and current calendar-month usage row.
2. Verify workspace bytes, global bytes, and the relevant monthly operation
   limit.
3. Reserve bytes and permanently count the provider request before calling S3.
4. Move reserved bytes to active bytes only after a successful PUT.
5. Retain consumed request allowance after a provider failure because AWS may
   still have received a billable request.

When a limit is reached, the API returns `507 Insufficient Storage` before an
S3 operation. It does not silently retain a file outside policy or depend on a
delayed AWS billing alert. AWS Budgets should still alert at $0.25 and apply a
defensive deny action near $0.45, but AWS documents that billing data can lag;
those controls are defense in depth rather than the circuit breaker.

## Upload, download, and failure behavior

- Uploads remain bounded to 10 MB and pass existing CSV/evidence validation
  before the source is retained.
- A durable budget reservation is created before `PutObject`.
- Objects use S3-managed AES-256 encryption (`SSE-S3`) and TLS. Customer-managed
  KMS keys are intentionally excluded because they add separate request and key
  charges without improving this demo's threat model.
- Authenticated downloads pass through FastAPI. The API reserves one read and
  the full object size as egress, then validates byte length and SHA-256 after
  `GetObject`.
- There are no public objects, browser AWS credentials, presigned URLs,
  multipart uploads, Transfer Acceleration, replication, inventory, access
  logging, or object version history in this slice.
- A provider or integrity failure returns a sanitized `503`; normalized data is
  not presented as a successfully retained upload when the configured storage
  operation fails.
- Artifact deletion hides the artifact and derivatives immediately. A failed
  physical delete remains `delete_pending` and is retried by bounded cleanup;
  the S3 lifecycle rule is the final backstop.
- Local development and credential-free CI keep storage explicitly disabled and
  label source retention as `ephemeral`. Tests inject an in-memory object store
  while exercising the same service and breaker contracts.

## Retention semantics

Application access ends exactly at the workspace/source expiry. CarbonSage
attempts physical deletion on artifact deletion and opportunistically sweeps
expired/delete-pending records before new retained uploads.

The bucket also expires objects after one day and aborts incomplete multipart
uploads after one day. S3 lifecycle processing is asynchronous, so the product
promise is:

> Source access ends within 24 hours; CarbonSage requests deletion at expiry,
> while S3 lifecycle processing provides the provider-level deletion backstop.

The lifecycle configuration is infrastructure policy, not a substitute for
application authorization or the database breaker.

## AWS resources and access

[`infra/aws/artifact-storage.yaml`](../../infra/aws/artifact-storage.yaml)
defines:

- one private, unversioned S3 bucket;
- default SSE-S3 encryption;
- complete public-access blocking and bucket-owner-enforced ownership;
- a TLS-only bucket policy;
- one-day expiration and incomplete-upload cleanup;
- a managed runtime policy limited to bucket location plus
  `PutObject`, `GetObject`, and `DeleteObject` under `workspaces/*`.

The template does not create or commit an access key. Attach its runtime policy
to a dedicated IAM principal, create credentials through AWS, and store them
only in Render's secret environment configuration.

Required production configuration:

```text
ARTIFACT_STORAGE_ENABLED=true
AWS_S3_BUCKET=<private bucket name>
AWS_S3_REGION=ca-central-1
AWS_ACCESS_KEY_ID=<Render secret>
AWS_SECRET_ACCESS_KEY=<Render secret>
DATABASE_URL=<existing Neon URL>
```

The remaining `ARTIFACT_STORAGE_*` values should normally keep their checked-in
defaults. Lower values are safe. Any higher combination still has to pass the
startup calculation below $0.50 and should require review of this decision.

## Operational checks before production activation

1. Deploy the CloudFormation stack in `ca-central-1`.
2. Confirm public access is blocked, versioning is suspended, default encryption
   is AES-256, and the one-day lifecycle rule is enabled.
3. Attach only the generated runtime policy to the dedicated API principal.
4. Add credentials and storage environment values in Render; never add them to
   Git, Vercel, browser code, logs, or screenshots.
5. Configure AWS Budget notifications at $0.25 and the defensive action near
   $0.45.
6. Deploy first through `dev`, upload and download one CSV and one text evidence
   file, then verify object metadata, breaker counters, and deletion.
7. Confirm cross-workspace source reads return `404`, expired source reads return
   `404`, and a forced breaker returns `507` without an S3 call.
8. Promote to `main` only after backend, frontend, PostgreSQL, browser, secret,
   and public smoke gates pass.

## Consequences

Positive consequences:

- Exact source files can be recovered briefly without storing bytes in
  PostgreSQL.
- CarbonSage demonstrates a production-relevant AWS integration and explicit
  cost governance.
- The object store can support future bounded reprocessing and selected-file
  imports without becoming the domain database.
- A provider adapter and durable ledger keep authorization, retention, and
  budget policy in application code.

Trade-offs:

- S3 is no longer literally free after promotional allowances, although the
  expected demo charge is normally below one cent and the priced hard envelope
  is approximately $0.379.
- Proxying downloads through Render is simpler and safer but consumes Render
  bandwidth. Direct presigned transfer is deferred until replay and cost
  controls are designed.
- Cleanup is opportunistic rather than worker-driven. The lifecycle rule is
  therefore mandatory.
- The $0.50 claim is S3-specific, pre-tax, and depends on exclusive use of the
  scoped runtime path. It is not an account-wide AWS spending guarantee.

## References

- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Budgets behavior](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- [S3 lifecycle configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [S3 public-access blocking](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
