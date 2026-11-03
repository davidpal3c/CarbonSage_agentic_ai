import BrandLockup from "@/app/components/BrandLockup";
import ButtonLink from "@/app/components/ButtonLink";
import MediaSlot from "@/app/components/MediaSlot";
import DashboardGlimpse from "@/app/components/page_components/DashboardGlimpse";
import PublicHeader from "@/app/components/page_components/PublicHeader";
import Parallax from "@/app/components/public/Parallax";
import PublicSurface from "@/app/components/public/PublicSurface";
import ScrollStory from "@/app/components/public/ScrollStory";
import SpineSection from "@/app/components/public/SpineSection";
import { comingSoonData, featuresData } from "@/app/lib/data";
import { photoCredits, type MediaSlotId } from "@/app/lib/media-slots";

// Shares and counts come from the fictional demo dataset (58 shipments).
const freightModes: ReadonlyArray<{
  slot: MediaSlotId;
  mode: string;
  shipments: number;
  share: number;
}> = [
  { slot: "mode-air", mode: "Air", shipments: 12, share: 63.7 },
  { slot: "mode-sea", mode: "Sea", shipments: 18, share: 23.8 },
  { slot: "mode-rail", mode: "Rail", shipments: 14, share: 7.7 },
  { slot: "mode-road", mode: "Road", shipments: 14, share: 4.8 },
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

        {/* The evidence journey: one centred, scroll-linked story. */}
        <SpineSection id="how" label="How it works" labelledBy="how-title">
          <Title id="how-title" quiet="Each calculation">
            keeps its trail.
          </Title>
          <p className={`${lead} -mt-4 max-w-[52ch]`}>
            Follow one shipment from the fictional demo dataset. CarbonSage
            calculates its footprint with a fixed formula, finds the supplier
            passage that bears on it, and cites that passage in the answer.
          </p>
          <p className="mt-3 max-w-[52ch] font-serif text-[15px] leading-6 text-muted-foreground">
            Illustrative walkthrough: the figures and the quoted passage are in
            the demo dataset; the question and answer wording is an example, not
            recorded model output.
          </p>
          <div className="pb-16 pt-14 lg:pb-28 lg:pt-20">
            <ScrollStory />
          </div>
        </SpineSection>

        {/* Current freight lens: offset photographs beside the figures. */}
        <SpineSection
          id="lens"
          label="Current freight lens"
          labelledBy="lens-title"
          tone="ink"
          contentClassName="lg:pr-0"
        >
          <div className="grid gap-12 pb-20 pt-6 lg:grid-cols-12 lg:gap-10 lg:pb-36 lg:pt-28">
            <div className="lg:col-span-5">
              <Title
                id="lens-title"
                quiet="The demo covers"
                className="display-light text-[clamp(2.1rem,4vw,3.25rem)] text-foreground"
              >
                freight across four modes.
              </Title>
              <p className={`${lead} mt-6 max-w-[46ch]`}>
                Freight and transportation suppliers are the current demo, not
                the limit of the idea: CarbonSage is aimed at Scope 3 decisions
                in general. The fictional dataset holds 38 suppliers, 58 dated
                shipments and five cited disclosures. Shares show how its
                emissions concentrate; they are not benchmarks, and data depth
                differs by mode.
              </p>
              <table className="mt-8 w-full max-w-[34rem] text-left text-[15px]">
                <caption className="sr-only">
                  Shipments and share of calculated emissions by transport mode
                  in the fictional demo dataset
                </caption>
                <thead>
                  <tr className="rail-label text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Mode
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Shipments
                    </th>
                    <th scope="col" className="py-2 pl-3 font-medium">
                      Share of emissions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {freightModes.map((row) => (
                    <tr
                      key={row.mode}
                      className="border-t border-foreground/30"
                    >
                      <th
                        scope="row"
                        className="py-2 pr-3 text-left font-normal"
                      >
                        <span className="flex items-center gap-3">
                          <span className="relative h-9 w-12 shrink-0 overflow-hidden">
                            <MediaSlot
                              slot={row.slot}
                              sizes="48px"
                              quality={45}
                            />
                          </span>
                          {row.mode}
                        </span>
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.shipments}
                      </td>
                      <td className="min-w-32 py-2 pl-3">
                        <span className="tabular-nums">{row.share}%</span>
                        <span
                          aria-hidden="true"
                          className="mt-1 block h-1 bg-foreground/15"
                        >
                          <span
                            className="block h-full bg-accent"
                            style={{ width: `${row.share}%` }}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="relative lg:col-span-7">
              <Parallax
                range={40}
                className="relative aspect-[4/3] bg-card sm:aspect-[5/4] lg:aspect-[4/5]"
              >
                <MediaSlot
                  slot="mode-rail"
                  sizes="(min-width: 1024px) 55vw, 100vw"
                />
              </Parallax>
              <Parallax
                range={20}
                className="absolute -bottom-12 left-6 hidden aspect-[4/3] w-[44%] border-[6px] border-background bg-card shadow-none lg:block xl:-left-12"
              >
                <MediaSlot slot="mode-sea" sizes="26vw" />
              </Parallax>
            </div>
          </div>
        </SpineSection>

        {/* Trust and limits: an editorial panel overlapping an environment photograph. */}
        <section
          aria-labelledby="trust-title"
          id="trust"
          className="tone-ink relative isolate scroll-mt-16 overflow-hidden bg-background text-foreground"
        >
          <Parallax range={56} className="absolute inset-0 -z-10">
            <MediaSlot slot="env-forest" sizes="100vw" quality={45} />
          </Parallax>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-b from-[#2d2b26]/85 via-[#2d2b26]/55 to-[#2d2b26]/70"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[var(--rail)] z-10 w-px bg-spine"
          />
          <div className="relative grid grid-cols-[var(--rail)_minmax(0,1fr)]">
            <p className="rail-label rail-index col-start-2 pl-5 pt-16 md:pl-8 lg:col-start-1 lg:pl-10 lg:pt-[7.4rem]">
              Trust and limits
            </p>
            <h2
              id="trust-title"
              className="display-light col-start-2 row-start-2 max-w-[18ch] px-5 pb-48 pt-6 text-[clamp(2.1rem,4.4vw,3.5rem)] md:px-8 lg:col-start-2 lg:row-start-1 lg:px-5 lg:pb-[22rem] lg:pt-28"
            >
              <span className="text-muted-foreground">What it does,</span> and
              what it does not claim.
            </h2>
          </div>
        </section>

        <SpineSection contentClassName="pb-16 lg:pb-28">
          <div className="relative z-10 -mt-40 border border-border bg-card px-6 py-8 shadow-none md:px-8 lg:-mt-64 lg:ml-auto lg:max-w-[46rem] lg:px-10 lg:py-10">
            <dl className="grid gap-x-10 md:grid-cols-2">
              {trustPoints.map((point) => (
                <div
                  key={point.title}
                  className="border-t border-foreground/30 py-5"
                >
                  <dt className="text-[18px] font-medium tracking-[-0.01em]">
                    {point.title}
                  </dt>
                  <dd className="mt-2 font-serif text-[15px] leading-6 text-muted-foreground">
                    {point.body}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 border-t border-foreground/30 pt-5 font-serif text-[15px] leading-6 text-muted-foreground">
              <span className="rail-label mr-3 font-sans text-foreground">
                Direction
              </span>
              Not available today: the same approach could later extend to other
              procurement evidence beyond freight.
            </p>
          </div>
        </SpineSection>

        {/* Product proof. */}
        <SpineSection
          id="product"
          label="Product"
          labelledBy="product-title"
          className="border-t border-spine"
        >
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
            <BrandLockup variant="mark" markClassName="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-5 px-5 md:px-8 lg:px-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <p>
                © {new Date().getFullYear()} CarbonSage · Evidence-grounded
                Scope 3 intelligence, wherever decisions happen
              </p>
              <nav
                aria-label="Footer"
                className="flex flex-wrap gap-x-6 gap-y-2"
              >
                <a
                  className="rail-label hover:text-foreground"
                  href="#baseline"
                >
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
            <details className="text-[13px] leading-5">
              <summary className="rail-label cursor-pointer">
                Photo credits
              </summary>
              <ul className="mt-3 space-y-1">
                {photoCredits.map((credit) => (
                  <li key={credit.title}>
                    <a
                      className="underline underline-offset-2"
                      href={credit.source}
                    >
                      {credit.title}
                    </a>{" "}
                    by {credit.author},{" "}
                    <a
                      className="underline underline-offset-2"
                      href={credit.licenseUrl}
                    >
                      {credit.license}
                    </a>{" "}
                    ({credit.subject}).
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                The other photographs are public domain or CC0; sources are
                recorded with the site&apos;s media files. Temporary images.
              </p>
            </details>
          </div>
        </div>
      </footer>
    </PublicSurface>
  );
}
