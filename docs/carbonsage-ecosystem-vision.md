# CarbonSage ecosystem vision

> **Status:** Post-initial-release strategy and opportunity map  
> **Domains secured:** `carbonsage.org` and `carbonsage.ca`  
> **Current delivery authority:** [`demo-roadmap.md`](demo-roadmap.md)  
> **Last updated:** August 9, 2026

This document preserves the larger CarbonSage opportunity without expanding
the active delivery scope. The current roadmap remains authoritative until the
initial release is complete and validated. Everything described here beyond
that boundary is a hypothesis, option, or staged direction that must earn its
place through user evidence.

## Executive thesis

CarbonSage can become more than a single application without becoming an
unfocused ESG suite.

The long-term opportunity is a two-part ecosystem:

- **CarbonSage.org** makes trustworthy ESG decision intelligence inspectable,
  reusable, measurable, and open to contribution.
- **CarbonSage.ca** turns the same contracts and methodology into a secure,
  managed product for private organizational workflows and, eventually, a
  supplier network and commercial marketplace.

The open layer creates trust, interoperability, technical adoption, and shared
learning. The commercial layer creates operational value through privacy,
reliability, integrations, collaboration, support, and network coordination.
The marketplace becomes viable only after CarbonSage proves that buyers and
suppliers repeatedly use the underlying decision workflow.

The central promise remains:

> CarbonSage helps people make traceable ESG and supplier decisions by joining
> structured operational data, cited evidence, deterministic tools, and
> explainable AI inside the systems where decisions already happen.

## The value CarbonSage can create

Most procurement and logistics teams do not lack data. They lack a dependable
way to connect shipment records, supplier claims, certifications, policies,
emissions factors, and operational constraints into one decision.

CarbonSage can reduce that gap for four audiences:

### Buyers and procurement teams

- Turn scattered shipment and supplier evidence into a decision-ready view.
- Compare lower-emission alternatives without losing assumptions or source
  provenance.
- Ask contextual questions and receive cited, calculation-backed answers.
- Reuse intelligence inside existing procurement, logistics, or ERP
  interfaces through the embeddable agent.
- Discover suppliers whose capabilities and evidence match a real operational
  requirement.

### Suppliers

- Maintain a reusable, evidence-backed sustainability and capability profile.
- Control which evidence is public, buyer-visible, or private.
- Reduce repeated questionnaires by sharing versioned facts and source
  documents through explicit permissions.
- Understand evidence gaps before responding to buyer requirements.
- Become discoverable for relevant opportunities without paying to alter an
  ESG score or evidence ranking.

### Developers and product teams

- Embed one authenticated agent and structured-response renderer into an
  existing JavaScript product.
- Use stable schemas for artifacts, citations, tools, charts, warnings, and
  confirmed actions.
- Integrate through REST, the JavaScript embed contract, or a bounded MCP
  adapter without duplicating CarbonSage domain logic.

### Researchers, practitioners, and the open community

- Inspect methodology and reproduce retrieval evaluations.
- Improve schemas, evaluation cases, reference data, and implementation
  guidance.
- Compare retrieval and orchestration approaches against explicit evidence.
- Help define practical conventions for trustworthy ESG agent behavior.

## Strategic identity and domain architecture

The two domains represent complementary responsibilities, not competing
brands:

```text
CarbonSage.org
├── Open standards, research, evaluations, and community
├── Docs, MCP, schemas, and reference implementation
└── Public-interest methodology

CarbonSage.ca
└── app.carbonsage.ca
    ├── Hosted ESG decision platform
    ├── Private workspaces
    ├── Supplier accounts
    └── Commercial marketplace
```

Potential future routing:

| Domain                | Intended role                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `carbonsage.org`      | Canonical home for the open initiative, mission, methodology, research, standards, and community   |
| `docs.carbonsage.org` | Public technical documentation, schemas, RFCs, reference guides, and evaluation reports            |
| `carbonsage.ca`       | Product positioning, customer use cases, commercial terms, and access to the hosted platform       |
| `app.carbonsage.ca`   | Authenticated hosted application, private workspaces, supplier accounts, and marketplace workflows |
| `api.carbonsage.ca`   | Managed API boundary when a compatibility-safe domain migration is justified                       |
| `embed.carbonsage.ca` | Optional dedicated origin for the authenticated iframe and loader contract                         |

The working Vercel and Render URLs remain valid until domain changes are
planned, tested, and rolled out safely. Purchasing the domains does not require
an immediate deployment migration.

The `.org` identity must not imply that CarbonSage is legally a nonprofit
unless such an entity is actually formed. Its honest meaning is that the
project has a mission-driven, open, and public-interest layer.

## Current initial delivery contract

The initial version remains intentionally narrow:

> An embeddable ESG decision agent demonstrating hybrid RAG, semantic
> retrieval, typed tool orchestration, cited responses, and interactive data
> visualizations.

Its purpose is to prove practical AI engineering in one credible vertical
workflow, not to launch a supplier marketplace or full carbon-accounting SaaS.

### Delivered foundation

The current implementation already provides:

- An isolated, signed, expiring workspace boundary with quotas and retention.
- Bounded shipment CSV and supplier-evidence ingestion.
- Deterministic Scope 3 freight calculations, factor provenance, scenarios,
  accessible visualizations, and report export.
- A workspace artifact catalog for shipment datasets, evidence documents, and
  report snapshots with source identity, versioning, rename, and soft delete.
- PostgreSQL full-text search, pgvector semantic search, and deterministic
  hybrid retrieval with provider-aware fallback.
- Recoverable artifact, document, page, and chunk citation identity.
- A checked-in retrieval evaluation set and reproducible CI fixtures.
- A modular FastAPI and Next.js application deployed through Render, Neon, and
  Vercel with automated backend, frontend, security, and browser gates.

The earlier NZeroESG prototype used ChromaDB as a standalone vector database.
CarbonSage retains that history while using pgvector inside PostgreSQL so
workspace ownership, lexical records, embeddings, citations, and retention
share one persistence boundary.

### Remaining initial delivery

The agreed delivery sequence remains:

1. Complete the authenticated, workspace-scoped typed agent runtime.
2. Validate a versioned structured-response contract for text, metrics,
   tables, charts, citations, warnings, artifact links, and confirmed actions.
3. Add the dashboard agent playground using the same runtime and renderer.
4. Deliver the framework-independent JavaScript loader and authenticated
   iframe.
5. Prove one explicit, read-only Google Drive selected-file import.
6. Optionally expose a small read-only MCP adapter after tools and
   authorization are stable.
7. Keep the deterministic five-minute workflow and all deployed gates green.

### Explicit boundary for the current work

The following remain deferred until the initial version is released and
reviewed:

- Production organization and supplier identity.
- Billing, subscriptions, plans, or paid accounts.
- A supplier marketplace, lead routing, transactions, or commissions.
- Automated certification verification or supplier scoring.
- Enterprise SSO, SCIM, broad RBAC, and procurement-system integrations.
- Background connector synchronization and large-scale ingestion workers.
- Additional Scope 3 categories beyond the current freight and supplier slice.

This boundary is deliberate. The future ecosystem becomes more credible when
it grows from a finished, measured vertical slice.

## CarbonSage.org: the open and public-interest layer

CarbonSage.org can become an open ESG decision-intelligence initiative focused
on transparency, interoperability, and practical implementation.

### Mission

> Make evidence-grounded ESG intelligence easier to inspect, evaluate, embed,
> and improve—without allowing an AI model or commercial incentive to become
> the hidden source of truth.

### Open standards and schemas

Candidate public contracts include:

- Artifact identity, provenance, lifecycle, and source metadata.
- Evidence documents, normalized chunks, and recoverable citations.
- Emissions-factor provenance, applicability, version, and assumptions.
- Supplier evidence and capability fields with explicit verification state.
- Typed tool input and output contracts.
- Structured conversation blocks for text, metrics, tables, charts,
  citations, warnings, and user-confirmed actions.
- Embed readiness, resize, authentication refresh, artifact navigation, and
  error events.

These should evolve through versioned proposals rather than undocumented
application behavior.

### Research and evaluation

CarbonSage.org can publish reproducible evidence about how the system behaves:

- Lexical, semantic, and hybrid retrieval evaluations.
- Citation coverage and source-recovery checks.
- Grounded-answer support and unsupported-claim rates.
- Tool-selection and argument-validity evaluations.
- Provider latency and cost comparisons.
- Structured-response validation and accessibility checks.
- Red-team cases for cross-workspace access, prompt injection, unsupported
  claims, and unsafe actions.

The goal is useful engineering evidence, not model-leaderboard theatre.
Synthetic or contributed evaluation data must be clearly labelled, licensed,
and free of private customer content.

### Documentation and reference implementation

The open initiative may provide:

- Architecture and security-boundary documentation.
- A reference modular-monolith implementation.
- Local deployment examples and bounded sample data.
- A vanilla JavaScript embed example.
- Provider-neutral tool and retrieval interfaces.
- Guides for adding an artifact type, deterministic tool, renderer block, or
  selected-file connector.
- Migration notes from the former ChromaDB design to PostgreSQL/pgvector.

Open code does not make the managed product free to operate. Users can inspect
or self-host the reference implementation while paying CarbonSage for a
secure, maintained, integrated service.

### MCP and interoperability

A future CarbonSage MCP server should be a thin protocol adapter over the same
application services used by REST and the embedded agent.

Two modes may eventually exist:

- A public or local read-only adapter for schemas, evaluation assets, public
  methodology, and explicitly public supplier data.
- An authenticated commercial adapter for workspace artifacts, evidence
  search, citations, calculations, and scenarios, subject to the same scopes,
  quotas, and audit boundaries as the hosted application.

The MCP surface must never become a parallel implementation of authorization,
retrieval, or domain calculations.

### Community participation

A useful community is built around concrete contribution paths:

- Propose or review schemas through lightweight RFCs.
- Add representative retrieval and safety evaluation cases.
- Improve documentation, adapters, examples, and accessibility.
- Contribute region- or industry-specific factor references with provenance.
- Discuss supplier evidence conventions and interoperability requirements.
- Report security, privacy, citation, or methodology concerns through defined
  channels.

The project should avoid launching an empty forum before there is a real body
of reusable work and a small group of practitioners who need it.

### Governance questions to answer later

Before claiming mature open governance, CarbonSage must decide:

- The code license and whether the hosted product uses an open-core,
  source-available, dual-license, or fully open-source model.
- Separate licenses for code, schemas, documentation, evaluation data, and
  contributed factor references.
- Trademark and brand-use rules for CarbonSage implementations.
- Maintainer roles, RFC acceptance, security disclosure, moderation, and
  conflict-of-interest policies.
- Whether governance stays with one company, adds an independent advisory
  group, or eventually separates into a foundation and commercial operator.

No legal structure is implied by domain ownership alone.

## CarbonSage.ca: the hosted product layer

CarbonSage.ca can provide the operational service that organizations do not
want to assemble or maintain themselves.

### Core managed value

The hosted product can charge for outcomes and operational guarantees such as:

- Private, durable organization workspaces.
- Managed ingestion, retrieval, embedding, and model-provider operations.
- Authentication, membership, roles, auditability, retention, and support.
- Connectors to document, procurement, logistics, and reporting systems.
- Versioned artifacts, supplier evidence, and decision records.
- Embedded agent configuration, origin controls, usage management, and APIs.
- Reliability, backups, monitoring, migration support, and service levels.

The customer is paying for secure execution, integration, collaboration, and
reduced operational burden—not for access to a hidden methodology.

### Private workspace evolution

The demo workspace can later evolve into an organization model with:

- Users, organizations, memberships, roles, and invitations.
- Buyer and supplier workspace types where the distinction proves useful.
- Configurable retention and evidence-sharing policies.
- Public, organization-private, counterparty-shared, and transaction-specific
  artifact visibility.
- Conversation, report, and decision histories with bounded audit events.
- Connector credentials and embed clients managed as revocable resources.

This is a future production-identity project, not an extension of the current
anonymous demo-session model.

## Supplier accounts and evidence network

Supplier accounts could transform CarbonSage from a buyer-side analysis tool
into a trusted coordination layer.

### Supplier profile

A supplier-controlled profile may contain:

- Legal and trading identity.
- Service categories, transport modes, operating regions, and capacity.
- Certifications, policies, commitments, and expiry dates.
- Emissions or intensity data with methodology and reporting period.
- Evidence artifacts and their sharing permissions.
- Verification state, verifier identity, limitations, and last-reviewed date.
- Contacts, buyer-specific questionnaires, and response history.

Every material claim should distinguish among:

- Supplier-declared.
- Document-supported.
- CarbonSage-validated for format or consistency.
- Independently verified.
- Expired, disputed, incomplete, or unavailable.

CarbonSage must not collapse these states into a vague confidence score.

### Value for suppliers

- Reuse evidence across qualified opportunities.
- Reduce duplicate questionnaires and document requests.
- See which missing facts prevent a match.
- Receive relevant buyer inquiries based on capability and evidence.
- Present a traceable profile without surrendering ownership of private data.

### Value for buyers

- Search by operational fit as well as sustainability evidence.
- Compare suppliers using consistent fields and recoverable sources.
- Identify evidence gaps before commercial engagement.
- Build a shortlist and decision record without outsourcing the final decision
  to the agent.

## Commercial marketplace possibility

The marketplace hypothesis is that CarbonSage can help convert evidence-backed
supplier discovery into introductions and transactions.

Possible capabilities, in increasing order of complexity:

1. Searchable public and permissioned supplier directory.
2. Buyer requirement or opportunity briefs.
3. Evidence-aware supplier matching and shortlists.
4. Consent-based introductions and messaging.
5. Requests for information or quotation.
6. Quote comparison and human-approved selection.
7. Transaction facilitation or integration with an external procurement
   system.
8. Commission or referral settlement where legally and operationally viable.

CarbonSage should not build payments, contracts, disputes, or transaction
operations until simpler introductions repeatedly create measurable value.

### Potential revenue streams

Revenue can develop in layers:

| Revenue stream                            | Customer value                                                           | Important boundary                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Buyer workspace subscriptions             | Managed decision intelligence, collaboration, reports, and integrations  | Core methodology and evidence provenance remain inspectable           |
| Supplier premium accounts                 | Evidence management, reusable profiles, opportunity tools, and analytics | A paid account cannot purchase a better ESG rank                      |
| Enterprise API and embed plans            | Secure integration, higher limits, support, and service levels           | Same typed tools, citations, and authorization contracts              |
| Managed onboarding or evidence operations | Data normalization, connector setup, and review workflows                | Verification state and reviewer identity stay explicit                |
| Qualified introductions                   | Relevant buyer-supplier connection                                       | Fees and commercial relationships are disclosed                       |
| Transaction commissions                   | Facilitation of a completed commercial relationship                      | Commission must not alter evidence assessment or recommendation logic |
| Aggregated benchmarks                     | Consented, privacy-preserving operational insight                        | No sale or leakage of private workspace or supplier data              |

The earliest credible revenue is likely hosted buyer workspaces and managed
integration. Marketplace commissions are potentially valuable but depend on
liquidity, trust, legal operations, and repeat transaction behavior.

## The open-commercial compact

CarbonSage should write down the promises that allow `.org` and `.ca` to
coexist:

1. **Methods are inspectable.** Core schemas, evidence states, and evaluation
   methods are not hidden to manufacture dependence.
2. **Private data stays private.** Open-source status never grants access to a
   customer's artifacts, prompts, supplier records, or credentials.
3. **Hosted convenience is valuable.** Security, reliability, integrations,
   collaboration, support, and network access are legitimate paid services.
4. **Commercial influence is visible.** Sponsorships, referrals, commissions,
   and paid placement are labelled and auditable.
5. **Payment cannot buy evidence quality.** Subscription status does not
   improve a supplier's verification state, citation support, or neutral
   ranking.
6. **The user remains accountable.** CarbonSage supports decisions; it does not
   autonomously select suppliers or make regulatory claims.
7. **Community work is not a lead-extraction disguise.** Public contributions
   and shared evaluation assets have clear terms and genuine reusable value.

## Trust, ranking, and marketplace integrity

Supplier discovery creates a conflict risk because CarbonSage may both inform
and monetize a decision. The system must separate three concepts:

- **Evidence assessment:** what sources support a claim and what is missing.
- **Operational matching:** how well a supplier meets a buyer's explicit
  requirement.
- **Commercial promotion:** whether a supplier paid for visible placement or a
  transaction service.

Evidence assessment and matching should use declared, versioned factors such
as capability, geography, transport mode, requirement fit, document support,
freshness, and buyer-selected preferences. Commercial promotion must be a
separate labelled surface and must not silently modify those results.

Additional safeguards should include:

- Recoverable sources and timestamps for material claims.
- Expiry and recertification handling.
- Supplier correction and dispute workflows.
- Buyer-visible data-quality and evidence-completeness warnings.
- No unqualified labels such as “greenest,” “compliant,” or “verified.”
- Human confirmation before introductions, disclosures, or transactions.
- Audit records for ranking configuration and commercial influence.

## Data rights and visibility model

A future network requires explicit data classes:

| Data class                                 | Default owner and visibility                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Public standards and methodology           | Public under the selected documentation or specification license               |
| Public evaluation fixtures                 | Public, synthetic or properly licensed, and free of customer data              |
| Community-contributed reference material   | Public only under explicit contribution and source terms                       |
| Supplier public profile                    | Supplier-controlled and intentionally published                                |
| Supplier evidence                          | Private by default; shared with named buyers or made public by explicit choice |
| Buyer requirements and workspace artifacts | Buyer-controlled and private by default                                        |
| Transaction records                        | Visible only to authorized counterparties and required operators               |
| Product telemetry                          | Minimized, access-controlled, and aggregated before any benchmark use          |

Consent to use data for one buyer workflow must not imply consent to train a
model, publish a benchmark, or expose a marketplace profile.

## A staged path from project to ecosystem

### Stage 0 — Complete the initial version

Deliver the typed agent, structured renderer, dashboard playground,
authenticated embed, one selected-file connector, and optional bounded MCP
proof. Preserve deterministic operation and production gates.

**Decision gate:** A reviewer can complete and understand the full embedded,
evidence-grounded workflow.

### Stage 1 — Release, observe, and learn

Publish the initial experience, collect structured feedback, and measure where
users find repeat value. Avoid adding marketplace code during this learning
period.

**Decision gate:** Real users repeat at least one workflow and can identify a
decision they would otherwise perform manually.

### Stage 2 — Operationalize CarbonSage.org

Publish selected schemas, evaluation assets, methodology, contribution rules,
and reference documentation. Choose licenses deliberately and test whether
external developers or practitioners reuse the work.

**Decision gate:** At least one external party reproduces an evaluation,
integrates a contract, or makes a substantive contribution.

### Stage 3 — Harden the hosted product

Introduce production identity, durable organizations, private workspaces,
managed connectors, billing, operational controls, and support only for
validated use cases.

**Decision gate:** A user or design partner is willing to pay for managed
operation, collaboration, integration, or support.

### Stage 4 — Pilot supplier accounts

Invite a small, curated set of suppliers to maintain evidence-backed profiles
and respond to realistic buyer requirements. Keep matching human-reviewed.

**Decision gate:** Buyers act on matches and suppliers receive relevant,
qualified opportunities.

### Stage 5 — Test marketplace economics

Add consent-based introductions, commercial terms, and a narrowly bounded
referral or commission experiment. Keep ranking neutrality measurable.

**Decision gate:** Completed introductions or transactions create enough
repeat value to justify the legal, trust, support, and operational burden.

## Metrics that matter

### Initial product quality

- End-to-end workflow completion.
- Citation coverage and source recovery.
- Supported-answer and unsupported-answer rates.
- Tool selection and argument validity.
- Deterministic result reconciliation.
- Embed authorization and origin-control failures.
- Provider latency, cost, and fallback reliability.

### Open initiative health

- Reproduced evaluations.
- External schema or reference-implementation use.
- Meaningful contributors and accepted proposals.
- Documentation completeness and time to first successful integration.
- Security, methodology, and accessibility issues resolved.

### Hosted product value

- Active workspaces and repeated decision workflows.
- Time from source upload to decision-ready output.
- Reuse of evidence and reports across decisions.
- Buyer and supplier retention.
- Conversion from demo to a managed-use case.
- Support burden and infrastructure cost per active organization.

### Marketplace validity

- Suppliers with current, evidence-backed profiles.
- Buyer requirements producing qualified shortlists.
- Match acceptance and introduction rates.
- Time to buyer-supplier engagement.
- Completed transactions and repeat counterparties.
- Disputes, corrections, ranking complaints, and evidence-expiry rates.

Marketplace revenue is not a sufficient success metric if trust or evidence
quality declines.

## Principal risks and responses

| Risk                                                        | Response                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Initial scope expands into an unfinished SaaS               | Keep the active roadmap authoritative and require post-release decision gates                                       |
| `.org` appears to be marketing for a closed product         | Publish genuinely reusable methodology, schemas, evaluations, and contribution terms                                |
| Commercial incentives compromise recommendations            | Separate evidence, matching, and promotion; disclose fees and prohibit pay-to-rank                                  |
| Supplier claims enable greenwashing                         | Preserve source identity, verification state, expiry, limitations, and dispute history                              |
| A two-sided marketplace has no liquidity                    | Start with buyer workflow value, then curate a small supplier pilot before marketplace infrastructure               |
| Private documents leak into public assets or model training | Use explicit visibility classes, consent, data minimization, and tenant isolation                                   |
| Open licensing weakens commercial defensibility             | Compete on managed operations, trust, integration, network value, and brand; choose licenses deliberately           |
| Organization and governance become performative             | Introduce governance only when real contributors and reusable assets exist                                          |
| Regulatory or verification claims exceed the product's role | Position CarbonSage as decision support and involve qualified legal or assurance professionals before regulated use |
| Infrastructure and support costs grow ahead of revenue      | Preserve quotas, measured provider use, staged plans, and explicit unit economics                                   |

## Organizational options for later

The domains leave several future structures open:

1. One mission-driven company maintains the open initiative and hosted product.
2. A commercial company operates CarbonSage.ca while an advisory council helps
   govern public specifications and evaluations.
3. A separate nonprofit foundation eventually stewards CarbonSage.org while a
   commercial operator builds hosted services on the standards.
4. A social-enterprise or public-benefit structure formalizes both mission and
   commercial sustainability where legally appropriate.

No structure should be adopted for optics. Governance should follow actual
community participation, funding needs, liability, and product-market
evidence.

## Durable decisions recorded now

- `carbonsage.org` and `carbonsage.ca` were secured in August 2026.
- CarbonSage.org is reserved for the open, methodological, research,
  interoperability, and community layer.
- CarbonSage.ca is reserved for the managed application and future commercial
  product.
- `app.carbonsage.ca` is the preferred future hosted-product origin.
- The existing verified Vercel and Render URLs remain until a separate domain
  migration is tested.
- The current initial roadmap does not include supplier accounts, billing, or
  marketplace implementation.
- Open/community value is genuine, but its licensing and governance require a
  later explicit decision.
- Supplier marketplace revenue is an exploration, not a current product claim.
- Any future commission model must be disclosed and isolated from evidence
  assessment and neutral matching.

## Questions to revisit after the initial release

- Which user repeats the workflow without prompting, and why?
- Is the embedded agent more valuable than the standalone dashboard?
- Which schemas or evaluations are genuinely useful outside CarbonSage?
- What should be open, and under which code, data, and documentation licenses?
- Do buyers want supplier discovery, or primarily intelligence over suppliers
  they already know?
- Are suppliers willing to maintain evidence-backed profiles?
- Which evidence can be public, and which must remain permissioned?
- Can introductions create value before CarbonSage handles transactions?
- Which revenue stream preserves trust while funding the work?
- Does the project need one organization, an advisory model, or separate open
  and commercial entities?


## Closing perspective

CarbonSage does not need to choose between public value and commercial value.
It needs a credible contract between them.

CarbonSage.org can make the methods, standards, and evidence for trustworthy
ESG intelligence more open. CarbonSage.ca can make those ideas secure,
operational, collaborative, and commercially sustainable. A supplier network
can eventually connect the two, but only after the initial product proves that
its evidence-grounded decision workflow matters in practice.

For now, the strongest strategy is still the smallest one: finish the decided
initial delivery exceptionally well, publish what is genuinely useful, and let
real adoption determine which parts of this larger vision deserve to become a
product.
