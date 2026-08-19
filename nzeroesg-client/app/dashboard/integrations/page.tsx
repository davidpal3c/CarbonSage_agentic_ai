import { Cloud, LockKeyhole } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <section className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Integrations
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Bring approved source documents into CarbonSage without duplicating
          your team&apos;s existing workflow.
        </p>
      </header>

      <article className="mt-7 max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
            <Cloud aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-primary">
                Google Drive
              </h2>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                Coming soon
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Select workspace files, preserve their source identity, and keep
              retrieval permissions tied to the connected account.
            </p>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="h-4 w-4 text-accent" />
              A connection will always require explicit authorization.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
