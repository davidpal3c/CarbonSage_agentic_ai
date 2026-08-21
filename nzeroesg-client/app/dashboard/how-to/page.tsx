import Link from "next/link";
import {
  Bot,
  Database,
  Download,
  FileSearch,
  SlidersHorizontal,
  Upload,
} from "lucide-react";

const steps = [
  {
    title: "Choose your workspace data",
    description:
      "Load the fictional simulation dataset for a guided start, or bring CSV/XLSX shipment records and PDF/TXT supplier documents.",
    icon: Database,
  },
  {
    title: "Ask a decision question",
    description:
      "Ask CarbonSage about supplier claims, freight emissions, missing information, or a lower-emission alternative.",
    icon: Bot,
  },
  {
    title: "Inspect the evidence",
    description:
      "Open citations, chart values, calculation details, and source artifacts before carrying a result into a decision.",
    icon: FileSearch,
  },
  {
    title: "Explore the simulation views",
    description:
      "Use Shipments and Suppliers for normalized records and supporting detail. Scenario workflows will be added after the core agent journey is settled.",
    icon: SlidersHorizontal,
  },
  {
    title: "Export what you need",
    description:
      "Download available source artifacts, normalized workspace data, or a decision report for review outside CarbonSage.",
    icon: Download,
  },
];

export default function HowToPage() {
  return (
    <section className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Workspace guide
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          How to use CarbonSage
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Start with the agent, keep the source trail visible, and use the
          workspace pages when you need to inspect or manage the underlying
          information.
        </p>
      </header>

      <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="flex gap-4 p-5 sm:p-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Step {index + 1}
                </p>
                <h2 className="mt-1 font-semibold text-primary">
                  {step.title}
                </h2>
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/dashboard/agent"
          className="rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/85"
        >
          Ask CarbonSage
        </Link>
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-muted"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          Choose data
        </Link>
      </div>
    </section>
  );
}
