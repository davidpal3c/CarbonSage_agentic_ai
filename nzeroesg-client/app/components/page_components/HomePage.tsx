import BrandMark from "@/app/components/BrandMark";
import ButtonLink from "@/app/components/ButtonLink";
import MediaSlot from "@/app/components/MediaSlot";
import DashboardGlimpse from "@/app/components/page_components/DashboardGlimpse";
import HeroPlate from "@/app/components/page_components/HeroPlate";
import PublicHeader from "@/app/components/page_components/PublicHeader";
import { comingSoonData, featuresData } from "@/app/lib/data";
import { evidenceSteps } from "@/app/lib/evidence-trail";
import type { MediaSlotId } from "@/app/lib/media-slots";

const shell = "mx-auto w-full max-w-[1280px] px-4 md:px-10";
const sectionLabel = "label-mono mb-5 text-accent";
const sectionTitle =
  "font-display text-[clamp(2rem,4.4vw,3.5rem)] text-foreground";

// Shares and counts come from the fictional demo dataset (58 shipments).
const freightModes: ReadonlyArray<{
  slot: MediaSlotId;
  mode: string;
  stat: string;
}> = [
  {
    slot: "mode-air",
    mode: "Air",
    stat: "12 shipments · 63.7% of demo emissions",
  },
  {
    slot: "mode-sea",
    mode: "Sea",
    stat: "18 shipments · 23.8% of demo emissions",
  },
  {
    slot: "mode-rail",
    mode: "Rail",
    stat: "14 shipments · 7.7% of demo emissions",
  },
  {
    slot: "mode-road",
    mode: "Road",
    stat: "14 shipments · 4.8% of demo emissions",
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

export default function HomePage() {
  return (
    <>
      <PublicHeader />

      <main id="top">
        {/* Hero: one proposition, the demo action, one image field. */}
        <section
          aria-labelledby="hero-title"
          className="border-b-[1.5px] border-foreground"
        >
          <div className="mx-auto grid max-w-[1680px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="order-2 flex flex-col px-4 pb-8 pt-8 md:px-10 lg:order-1 lg:py-9">
              <p className="label-mono mb-5 text-tertiary">
                Scope 3 decision intelligence
              </p>
              <h1
                id="hero-title"
                // Reserve the four-line height the wide display face needs on small
                // screens, so the font swap cannot shift the copy below it.
                className="font-display mb-5 text-[clamp(2.4rem,5vw,3.6rem)] text-foreground max-sm:min-h-[3.92em]"
              >
                See the <span className="text-tertiary">evidence</span> behind
                Scope&nbsp;3 decisions.
              </h1>
              <p className="mb-3 max-w-[44ch] text-[17px] leading-[1.5]">
                CarbonSage joins shipment data, supplier documents and
                deterministic emissions tools, so every answer shows its numbers
                and its sources.
              </p>
              <p className="mb-6 text-[15px] text-muted-foreground">
                <span className="label-mono mr-2 inline-block bg-foreground px-1.5 py-1 text-[11px] text-background">
                  Current demo
                </span>
                Freight and transportation suppliers, using a fictional dataset.
              </p>
              <div className="mb-4 flex flex-wrap gap-3">
                <ButtonLink href="/login">Try the demo</ButtonLink>
                <ButtonLink href="#how" variant="ghost">
                  How it works
                </ButtonLink>
              </div>
              <p className="text-sm text-muted-foreground">
                No account. A private workspace that expires after 24 hours.
              </p>

              <ol
                aria-label="The evidence trail"
                className="mt-8 border-t-[1.5px] border-foreground lg:mt-auto lg:pt-1"
              >
                {evidenceSteps.map((step, index) => (
                  <li
                    key={step.title}
                    className="grid grid-cols-[2rem_1fr] gap-x-3 border-b border-border py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="row-span-2 flex h-6 w-6 items-center justify-center bg-foreground font-mono text-[13px] text-background"
                    >
                      {index + 1}
                    </span>
                    <strong className="text-sm font-bold">{step.title}</strong>
                    <span className="font-mono text-xs leading-snug text-muted-foreground">
                      {step.summary}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="order-1 border-b-[1.5px] border-foreground lg:order-2 lg:border-b-0 lg:border-l-[1.5px]">
              <HeroPlate />
            </div>
          </div>
        </section>

        {/* From operational data to evidence. */}
        <section
          id="how"
          aria-labelledby="how-title"
          className="scroll-mt-16 border-b-[1.5px] border-foreground py-20 md:py-28"
        >
          <div
            className={`${shell} grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16`}
          >
            <div>
              <p className={sectionLabel}>
                01 · From operational data to evidence
              </p>
              <h2 id="how-title" className={sectionTitle}>
                Every figure keeps its trail.
              </h2>
              <p className="mt-6 max-w-[46ch] leading-7 text-muted-foreground">
                Follow one shipment from the fictional demo dataset. CarbonSage
                calculates its footprint with a fixed formula, finds the
                supplier passage that bears on it, and cites that passage in the
                answer.
              </p>
              <p className="mt-4 max-w-[46ch] text-sm leading-6 text-muted-foreground">
                Illustrative walkthrough: the figures and the quoted passage are
                in the demo dataset; the question and answer wording is an
                example, not recorded model output.
              </p>
            </div>

            <div>
              <ol className="border-t-[1.5px] border-foreground">
                {evidenceSteps.map((step, index) => (
                  <li
                    key={step.title}
                    className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-border py-5"
                  >
                    <span
                      aria-hidden="true"
                      className="row-span-3 flex h-7 w-7 items-center justify-center bg-foreground font-mono text-sm text-background"
                    >
                      {index + 1}
                    </span>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="font-mono text-[13px] text-accent">
                      {step.summary}
                    </p>
                    <p className="mt-1.5 text-[15px] leading-6 text-muted-foreground">
                      {step.detail}
                    </p>
                  </li>
                ))}
              </ol>

              <figure className="mt-8 border-l-4 border-tertiary bg-card px-5 py-4 md:px-6">
                <p className="label-mono mb-3 text-muted-foreground">
                  Example question and answer
                </p>
                <p className="mb-3 text-[15px] font-semibold">
                  Does Northstar Logistics report a lower-emission option for
                  long lanes?
                </p>
                <blockquote className="text-[15px] leading-7">
                  Its disclosure reports a rail-intermodal option for lanes over
                  800 km and estimates a 31 percent emissions reduction for
                  eligible intermodal routes compared with its conventional
                  truck baseline [1]. Refrigerated service and last-mile
                  delivery remain truck-only [1]. This is the supplier&rsquo;s
                  own estimate, not a verified figure.
                </blockquote>
                <figcaption className="mt-3 font-mono text-xs text-muted-foreground">
                  [1] northstar-logistics-disclosure.txt
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Current freight lens. */}
        <section
          id="lens"
          aria-labelledby="lens-title"
          className="scroll-mt-16 border-b-[1.5px] border-foreground py-20 md:py-28"
        >
          <div className={shell}>
            <div className="mb-12 grid gap-6 lg:grid-cols-[5fr_7fr] lg:gap-16">
              <div>
                <p className={sectionLabel}>02 · Current freight lens</p>
                <h2 id="lens-title" className={sectionTitle}>
                  The demo covers freight across four modes.
                </h2>
              </div>
              <p className="max-w-[56ch] self-end leading-7 text-muted-foreground">
                Freight and transportation suppliers are the current demo, not
                the limit of the idea: CarbonSage is aimed at Scope 3 decisions
                in general. The fictional dataset holds 38 suppliers, 58 dated
                shipments and five cited disclosures. Shares below show how its
                emissions concentrate; they are not benchmarks, and data depth
                differs by mode.
              </p>
            </div>

            <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {freightModes.map(({ slot, mode, stat }) => (
                <li key={slot}>
                  <figure>
                    <div className="aspect-[4/3] overflow-hidden border-[1.5px] border-foreground bg-secondary-bg">
                      <MediaSlot
                        slot={slot}
                        sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 100vw"
                      />
                    </div>
                    <figcaption className="mt-3">
                      <span className="label-mono text-foreground">{mode}</span>
                      <span className="mt-1.5 block text-sm text-muted-foreground">
                        {stat}
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Product proof. */}
        <section
          id="product"
          aria-labelledby="product-title"
          className="scroll-mt-16 border-b-[1.5px] border-foreground py-20 md:py-28"
        >
          <div
            className={`${shell} grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16`}
          >
            <div>
              <p className={sectionLabel}>03 · Product proof</p>
              <h2 id="product-title" className={sectionTitle}>
                The workspace, with the numbers in view.
              </h2>
              <ul className="mt-6 max-w-[46ch] space-y-3 leading-7 text-muted-foreground">
                <li>
                  Overview, agent, shipments, suppliers, scenarios, artifacts
                  and report views in one routed workspace.
                </li>
                <li>
                  Answers return metrics, charts, exact table values, citations
                  and concise tool activity.
                </li>
                <li>
                  Start with the fictional dataset, or upload CSV/XLSX shipments
                  and PDF/TXT supplier evidence.
                </li>
              </ul>
            </div>
            <DashboardGlimpse />
          </div>
        </section>

        {/* Trust and scope. */}
        <section
          id="trust"
          aria-labelledby="trust-title"
          className="scroll-mt-16 border-b-[1.5px] border-foreground py-20 md:py-28"
        >
          <div className={shell}>
            <p className={sectionLabel}>04 · Trust and limits</p>
            <h2 id="trust-title" className={`${sectionTitle} max-w-[18ch]`}>
              What it does, and what it does not claim.
            </h2>
            <dl className="mt-12 grid gap-x-16 md:grid-cols-2">
              {trustPoints.map((point) => (
                <div
                  key={point.title}
                  className="border-t-[1.5px] border-foreground py-6"
                >
                  <dt className="text-lg font-bold">{point.title}</dt>
                  <dd className="mt-2 max-w-[52ch] leading-7 text-muted-foreground">
                    {point.body}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 max-w-[64ch] border-t-[1.5px] border-foreground pt-6 leading-7 text-muted-foreground">
              <span className="label-mono mr-2 inline-block bg-foreground px-1.5 py-1 text-[11px] text-background">
                Direction
              </span>
              Not available today: the same approach could later extend to other
              procurement evidence beyond freight.
            </p>
          </div>
        </section>

        {/* Technical baseline and roadmap, kept below the primary story. */}
        <section
          id="baseline"
          aria-labelledby="baseline-title"
          className="scroll-mt-16 border-b-[1.5px] border-foreground py-20 md:py-24"
        >
          <div className={`${shell} grid gap-12 lg:grid-cols-2 lg:gap-16`}>
            <div>
              <p className={sectionLabel}>05 · Technical baseline</p>
              <h2 id="baseline-title" className="font-display text-3xl">
                What works today
              </h2>
              <dl className="mt-8 border-t-[1.5px] border-foreground">
                {featuresData.map((item) => (
                  <div key={item.id} className="border-b border-border py-4">
                    <dt className="font-bold">{item.title}</dt>
                    <dd className="mt-1 text-[15px] leading-6 text-muted-foreground">
                      {item.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div id="roadmap" className="scroll-mt-16">
              <p className={sectionLabel}>06 · Roadmap</p>
              <h2 className="font-display text-3xl">
                Upcoming, not available yet
              </h2>
              <dl className="mt-8 border-t-[1.5px] border-foreground">
                {comingSoonData.map((item) => (
                  <div key={item.id} className="border-b border-border py-4">
                    <dt className="font-bold">{item.title}</dt>
                    <dd className="mt-1 text-[15px] leading-6 text-muted-foreground">
                      {item.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Closing action. */}
        <section
          aria-labelledby="close-title"
          className="bg-band py-20 text-band-foreground md:py-24"
        >
          <div
            className={`${shell} grid items-end gap-8 lg:grid-cols-[7fr_5fr]`}
          >
            <div>
              <p className="label-mono mb-5 text-band-muted">Try the demo</p>
              <h2
                id="close-title"
                className="font-display text-[clamp(2rem,4.4vw,3.5rem)]"
              >
                Open a private workspace and ask a question.
              </h2>
              <p className="mt-6 max-w-[52ch] leading-7 text-band-muted">
                You will find a fictional dataset of 38 suppliers, 58 shipments
                and five cited disclosures, or you can upload your own CSV/XLSX
                shipments and PDF/TXT supplier evidence. No account is needed.
              </p>
            </div>
            <div>
              <ButtonLink href="/login" variant="onBand">
                Try the demo
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-[1.5px] border-foreground bg-background py-8">
        <div
          className={`${shell} flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between`}
        >
          <p className="flex items-center gap-2.5">
            <BrandMark className="h-5 w-5" />
            <span>
              © {new Date().getFullYear()} CarbonSage · Evidence-grounded Scope
              3 intelligence, wherever decisions happen
            </span>
          </p>
          <nav aria-label="Footer" className="flex gap-6">
            <a className="label-mono hover:text-foreground" href="#baseline">
              Baseline
            </a>
            <a className="label-mono hover:text-foreground" href="#roadmap">
              Roadmap
            </a>
            <a className="label-mono hover:text-foreground" href="#top">
              Top
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
