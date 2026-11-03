import BrandMark from "@/app/components/BrandMark";
import ButtonLink from "@/app/components/ButtonLink";
import MediaSlot from "@/app/components/MediaSlot";
import DashboardGlimpse from "@/app/components/page_components/DashboardGlimpse";
import PublicHeader from "@/app/components/page_components/PublicHeader";
import PublicSurface from "@/app/components/public/PublicSurface";
import SpineSection from "@/app/components/public/SpineSection";
import { comingSoonData, featuresData } from "@/app/lib/data";
import { evidenceSteps } from "@/app/lib/evidence-trail";
import type { MediaSlotId } from "@/app/lib/media-slots";

// Shares and counts come from the fictional demo dataset (58 shipments).
const freightModes: ReadonlyArray<{
  slot: MediaSlotId;
  id: string;
  quiet: string;
  loud: string;
  stat: string;
}> = [
  {
    slot: "mode-air",
    id: "mode-air",
    quiet: "Freight",
    loud: "by air.",
    stat: "12 shipments in the fictional demo dataset, 63.7% of its calculated emissions.",
  },
  {
    slot: "mode-sea",
    id: "mode-sea",
    quiet: "Freight",
    loud: "by sea.",
    stat: "18 shipments in the fictional demo dataset, 23.8% of its calculated emissions.",
  },
  {
    slot: "mode-rail",
    id: "mode-rail",
    quiet: "Freight",
    loud: "by rail.",
    stat: "14 shipments in the fictional demo dataset, 7.7% of its calculated emissions.",
  },
  {
    slot: "mode-road",
    id: "mode-road",
    quiet: "Freight",
    loud: "by road.",
    stat: "14 shipments in the fictional demo dataset, 4.8% of its calculated emissions.",
  },
];

const trustPoints = [
  {
    title: "Deterministic numbers",
    body: "Typed calculation tools own every emissions value, with versioned factors and stated assumptions. The agent explains validated results; it does not invent them.",
  },
  {
    title: "Cited evidence",
    body: "Supplier answers carry recoverable file, page and passage locations. Passages that are only related, or do not support a claim, return an explicit limitation instead.",
  },
  {
    title: "A private, temporary workspace",
    body: "Each visit gets its own signed workspace, kept for at most 24 hours. No account is needed, and one visitor's records are not visible to another.",
  },
  {
    title: "Limits",
    body: "CarbonSage is a prototype. Factors are screening estimates, not audited carbon accounting, and answer quality is not guaranteed. Answers also depend on a configured model provider; calculations, retrieval and exports work without one.",
  },
];

const sectionTitle =
  "display-light text-[clamp(2.1rem,4.4vw,3.5rem)] text-foreground pt-16 pb-14 lg:pt-28 lg:pb-20 max-w-[22ch]";
const lead = "font-serif text-[17px] leading-[1.6] text-muted-foreground";

/** Two-tone display heading: a quiet lead-in, then the statement. */
function Title({
  id,
  quiet,
  children,
  className = sectionTitle,
}: {
  id: string;
  quiet: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 id={id} className={className}>
      <span className="tone-quiet">{quiet}</span> {children}
    </h2>
  );
}

export default function HomePage() {
  return (
    <PublicSurface>
      <PublicHeader />

      <main id="top">
        {/* Hero: one proposition over one image field, then the demo action. */}
        <SpineSection tone="ink" labelledBy="hero-title">
          <h1
            id="hero-title"
            className="display-light max-w-[20ch] pb-10 pt-16 text-[clamp(2.4rem,5.2vw,4rem)] text-foreground md:pb-14 lg:max-w-[24ch] lg:pb-16 lg:pt-[7.5rem]"
          >
            <span className="tone-quiet">See the evidence behind</span> Scope
            3&nbsp;decisions.
          </h1>
        </SpineSection>

        <section
          aria-label="Introduction"
          className="tone-ink relative isolate overflow-hidden bg-background text-foreground"
        >
          <MediaSlot slot="hero-terminal-night" preload sizes="100vw" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-[#2d2b26]/95 via-[#2d2b26]/80 to-[#2d2b26]/40"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[var(--rail)] z-10 w-px bg-spine"
          />
          <div className="relative grid min-h-[min(72vh,36rem)] grid-cols-[var(--rail)_minmax(0,1fr)] pb-14 lg:pb-24">
            <div className="col-start-2 max-w-[44rem] px-5 pt-6 md:px-8 lg:px-5 lg:pt-8">
              <p className="text-[18px] font-medium leading-[1.4] tracking-[-0.01em] text-foreground">
                CarbonSage joins shipment data, supplier documents and
                deterministic emissions tools. Calculated figures show their
                inputs, supported claims cite their source, and unsupported ones
                say so.
              </p>
              <p className="mt-4 max-w-[40ch] font-serif text-[16px] leading-6 text-foreground">
                Current demo: freight and transportation suppliers, using a
                fictional dataset.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/login">Try the demo</ButtonLink>
                <ButtonLink href="#how" variant="ghost">
                  How it works
                </ButtonLink>
              </div>
              <p className="mt-4 font-serif text-[15px] text-foreground">
                No account. A private workspace that expires after 24 hours.
              </p>
            </div>
          </div>
        </section>

        {/* Premise. */}
        <SpineSection tone="ink" label="What it does" labelledBy="idea-title">
          <h2
            id="idea-title"
            className="display-light max-w-[26ch] pb-20 pt-6 text-[clamp(1.9rem,3.6vw,3rem)] text-foreground lg:max-w-[30ch] lg:pb-32 lg:pt-28"
          >
            <span className="tone-quiet">
              Supplier emissions answers are only as strong as the evidence
              behind them.
            </span>{" "}
            CarbonSage keeps the calculation, the source passage and the limits
            of each answer in view, so a reader can check them.
          </h2>
        </SpineSection>

        {/* From operational data to evidence. */}
        <SpineSection id="how" label="How it works" labelledBy="how-title">
          <Title id="how-title" quiet="Each calculation">
            keeps its trail.
          </Title>

          <p className={`${lead} max-w-[52ch]`}>
            Follow one shipment from the fictional demo dataset. CarbonSage
            calculates its footprint with a fixed formula, finds the supplier
            passage that bears on it, and cites that passage in the answer.
          </p>
          <p className="mt-3 max-w-[52ch] font-serif text-[15px] leading-6 text-muted-foreground">
            Illustrative walkthrough: the figures and the quoted passage are in
            the demo dataset; the question and answer wording is an example, not
            recorded model output.
          </p>

          <ol className="mt-14 grid gap-x-8 gap-y-0 sm:grid-cols-2 xl:grid-cols-4">
            {evidenceSteps.map((step, index) => (
              <li
                key={step.title}
                className="border-t border-foreground/30 py-6"
              >
                <span
                  aria-hidden="true"
                  className="rail-label mb-4 block text-muted-foreground"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[19px] font-medium leading-snug tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-5 text-accent">
                  {step.summary}
                </p>
                <p className="mt-3 font-serif text-[15px] leading-6 text-muted-foreground">
                  {step.detail}
                </p>
              </li>
            ))}
          </ol>

          <figure className="mb-16 mt-12 max-w-[46rem] border-l-2 border-accent bg-card px-5 py-5 md:px-7 lg:mb-28">
            <p className="rail-label mb-3 text-muted-foreground">
              Example question and answer
            </p>
            <p className="mb-3 text-[16px] font-medium">
              Does Northstar Logistics report a lower-emission option for long
              lanes?
            </p>
            <blockquote className="font-serif text-[17px] leading-[1.6]">
              Its disclosure reports a rail-intermodal option for lanes over 800
              km and estimates a 31 percent emissions reduction for eligible
              intermodal routes compared with its conventional truck baseline
              [1]. Refrigerated service and last-mile delivery remain truck-only
              [1]. This is the supplier&rsquo;s own estimate, not a verified
              figure.
            </blockquote>
            <figcaption className="mt-3 text-[13px] text-muted-foreground">
              [1] northstar-logistics-disclosure.txt
            </figcaption>
          </figure>
        </SpineSection>

        {/* Current freight lens: an introduction, then one band per mode. */}
        <SpineSection
          id="lens"
          label="Current freight lens"
          labelledBy="lens-title"
          tone="ink"
        >
          <Title id="lens-title" quiet="The demo covers">
            freight across four modes.
          </Title>
          <p className={`${lead} -mt-4 max-w-[56ch] pb-16 lg:pb-24`}>
            Freight and transportation suppliers are the current demo, not the
            limit of the idea: CarbonSage is aimed at Scope 3 decisions in
            general. The fictional dataset holds 38 suppliers, 58 dated
            shipments and five cited disclosures. Shares below show how its
            emissions concentrate; they are not benchmarks, and data depth
            differs by mode.
          </p>
        </SpineSection>

        {freightModes.map(({ slot, id, quiet, loud, stat }) => (
          <section
            key={id}
            aria-labelledby={`${id}-title`}
            className="tone-ink relative isolate overflow-hidden bg-background text-foreground"
          >
            <MediaSlot slot={slot} sizes="100vw" />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-[#2d2b26]/92 via-[#2d2b26]/65 to-[#2d2b26]/30"
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-[var(--rail)] z-10 w-px bg-spine"
            />
            <div className="relative grid min-h-[min(80vh,34rem)] grid-cols-[var(--rail)_minmax(0,1fr)]">
              <div className="col-start-2 grid content-start gap-6 px-5 pb-16 pt-12 md:px-8 lg:grid-cols-[1fr_21rem] lg:gap-16 lg:px-5 lg:pt-16">
                <h2
                  id={`${id}-title`}
                  className="display-light text-[clamp(2.4rem,4.6vw,3.75rem)] text-foreground"
                >
                  <span className="text-muted-foreground">{quiet}</span>
                  <br />
                  {loud}
                </h2>
                <p className="max-w-[34ch] font-serif text-[17px] leading-[1.55] text-foreground lg:pt-2">
                  {stat}
                </p>
              </div>
            </div>
          </section>
        ))}

        {/* Product proof. */}
        <SpineSection id="product" label="Product" labelledBy="product-title">
          <Title id="product-title" quiet="The workspace, with the">
            numbers in view.
          </Title>
          <ul className={`${lead} max-w-[52ch] space-y-3`}>
            <li>
              Overview, agent, shipments, suppliers, scenarios, artifacts and
              report views in one routed workspace.
            </li>
            <li>
              Answers return metrics, charts, exact table values, citations and
              concise tool activity.
            </li>
            <li>
              Start with the fictional dataset, or upload CSV/XLSX shipments and
              PDF/TXT supplier evidence.
            </li>
          </ul>
          <div className="mb-16 mt-12 max-w-[56rem] lg:mb-28">
            <DashboardGlimpse />
          </div>
        </SpineSection>

        {/* Trust and scope. */}
        <SpineSection
          id="trust"
          label="Trust and limits"
          labelledBy="trust-title"
          className="border-t border-spine"
        >
          <Title id="trust-title" quiet="What it does,">
            and what it does not claim.
          </Title>
          <dl className="grid gap-x-12 md:grid-cols-2">
            {trustPoints.map((point) => (
              <div
                key={point.title}
                className="border-t border-foreground/30 py-6"
              >
                <dt className="text-[19px] font-medium tracking-[-0.01em]">
                  {point.title}
                </dt>
                <dd className={`${lead} mt-2 max-w-[52ch]`}>{point.body}</dd>
              </div>
            ))}
          </dl>
          <p
            className={`${lead} mb-16 mt-2 max-w-[64ch] border-t border-foreground/30 pt-6 lg:mb-28`}
          >
            <span className="rail-label mr-3 font-sans text-foreground">
              Direction
            </span>
            Not available today: the same approach could later extend to other
            procurement evidence beyond freight.
          </p>
        </SpineSection>

        {/* Technical baseline and roadmap, kept below the primary story. */}
        <SpineSection
          id="baseline"
          label="Technical baseline"
          labelledBy="baseline-title"
          className="border-t border-spine"
        >
          <div className="grid gap-x-16 pb-16 pt-16 lg:grid-cols-2 lg:pb-28 lg:pt-28">
            <div>
              <h2
                id="baseline-title"
                className="display-light text-[clamp(1.8rem,3vw,2.5rem)]"
              >
                What works today
              </h2>
              <dl className="mt-8">
                {featuresData.map((item) => (
                  <div
                    key={item.id}
                    className="border-t border-foreground/30 py-4"
                  >
                    <dt className="font-medium">{item.title}</dt>
                    <dd className="mt-1 font-serif text-[15px] leading-6 text-muted-foreground">
                      {item.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div id="roadmap" className="mt-14 scroll-mt-16 lg:mt-0">
              <h2 className="display-light text-[clamp(1.8rem,3vw,2.5rem)]">
                Upcoming, not available yet
              </h2>
              <dl className="mt-8">
                {comingSoonData.map((item) => (
                  <div
                    key={item.id}
                    className="border-t border-foreground/30 py-4"
                  >
                    <dt className="font-medium">{item.title}</dt>
                    <dd className="mt-1 font-serif text-[15px] leading-6 text-muted-foreground">
                      {item.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </SpineSection>

        {/* Closing action. */}
        <SpineSection tone="ink" label="Try the demo" labelledBy="close-title">
          <h2
            id="close-title"
            className="display-light max-w-[20ch] pb-8 pt-6 text-[clamp(2.1rem,4.4vw,3.5rem)] lg:pt-28"
          >
            <span className="tone-quiet">Open a private workspace</span> and ask
            a question.
          </h2>
          <p className={`${lead} max-w-[52ch]`}>
            You will find a fictional dataset of 38 suppliers, 58 shipments and
            five cited disclosures, or you can upload your own CSV/XLSX
            shipments and PDF/TXT supplier evidence. No account is needed.
          </p>
          <div className="pb-20 pt-8 lg:pb-32">
            <ButtonLink href="/login">Try the demo</ButtonLink>
          </div>
        </SpineSection>
      </main>

      <footer className="tone-ink relative border-t border-spine bg-background text-foreground">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-[var(--rail)] w-px bg-spine"
        />
        <div className="grid grid-cols-[var(--rail)_minmax(0,1fr)] py-8 text-sm text-muted-foreground">
          <div className="flex items-start justify-center lg:justify-start lg:pl-10">
            <BrandMark className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-5 px-5 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-5">
            <p>
              © {new Date().getFullYear()} CarbonSage · Evidence-grounded Scope
              3 intelligence, wherever decisions happen
            </p>
            <nav aria-label="Footer" className="flex gap-6">
              <a className="rail-label hover:text-foreground" href="#baseline">
                Baseline
              </a>
              <a className="rail-label hover:text-foreground" href="#roadmap">
                Roadmap
              </a>
              <a className="rail-label hover:text-foreground" href="#top">
                Top
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </PublicSurface>
  );
}
