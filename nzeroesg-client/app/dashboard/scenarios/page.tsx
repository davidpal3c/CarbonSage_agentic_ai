import Link from "next/link";
import { Route } from "lucide-react";

export default function ScenariosPage() {
  return (
    <section className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Scenarios
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Compare sourcing and freight alternatives without losing the evidence
          behind the baseline.
        </p>
      </header>

      <article className="mt-7 flex min-h-72 items-center justify-center rounded-xl border border-dashed border-border bg-card p-7 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
            <Route aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Coming soon
          </p>
          <h2 className="mt-2 text-xl font-semibold text-primary">
            Guided scenario modelling
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The next iteration will turn agent-proposed alternatives into saved,
            comparable simulations. Freight comparisons remain available through
            Ask CarbonSage in the meantime.
          </p>
          <Link
            href="/dashboard/agent"
            className="mt-5 inline-flex rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-accent"
          >
            Ask CarbonSage
          </Link>
        </div>
      </article>
    </section>
  );
}
