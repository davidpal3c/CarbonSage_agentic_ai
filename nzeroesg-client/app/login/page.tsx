"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { getBackendUrl } from "@/app/api/urls";
import BrandLockup from "@/app/components/BrandLockup";
import MediaSlot from "@/app/components/MediaSlot";
import PublicSurface from "@/app/components/public/PublicSurface";
import { Spinner } from "@/app/components/Spinner";

export default function LoginPage() {
  const router = useRouter();
  const [isEntering, setIsEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterDemoWorkspace() {
    setIsEntering(true);
    setError(null);

    try {
      const response = await fetch(`${getBackendUrl()}/demo/session`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("The demo workspace could not be created.");
      }
      router.push("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The demo workspace could not be created.",
      );
    } finally {
      setIsEntering(false);
    }
  }

  return (
    <PublicSurface>
      <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col px-5 py-6 md:px-10 lg:px-14 lg:py-9">
          <Link
            href="/"
            aria-label="CarbonSage home"
            className="flex w-fit items-center"
          >
            <BrandLockup variant="large" />
          </Link>

          <section className="my-auto max-w-xl py-14">
            <p className="rail-label rail-index mb-6 text-foreground">
              Current demo
            </p>
            <h1 className="display-light mb-6 text-[clamp(2.25rem,4.4vw,3.5rem)] text-foreground">
              <span className="tone-quiet">Enter the</span> demo workspace
            </h1>
            <p className="mb-8 max-w-[46ch] font-serif text-[17px] leading-[1.6] text-muted-foreground">
              A private, short-lived workspace is created for your visit. Use it
              to upload data, review evidence, and try CarbonSage. The demo
              covers freight and transportation suppliers, and you can start
              from a fictional dataset or your own files.
            </p>

            <dl className="mb-8 border-t border-foreground/30">
              {[
                ["24 hours", "workspace retention"],
                ["Private", "isolated workspace"],
                ["No account", "start immediately"],
              ].map(([term, detail]) => (
                <div
                  key={term}
                  className="flex items-baseline justify-between gap-4 border-b border-border py-3"
                >
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-sm text-muted-foreground">{detail}</dd>
                </div>
              ))}
            </dl>

            {error ? (
              <p
                role="alert"
                className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error} Check that the API is running and try again.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                type="button"
                onClick={enterDemoWorkspace}
                disabled={isEntering}
                className="inline-flex min-h-12 items-center gap-2 bg-foreground px-6 text-[13px] font-medium uppercase tracking-[0.03em] text-background transition-colors hover:bg-foreground/85 disabled:cursor-wait disabled:opacity-60"
              >
                {isEntering ? <Spinner /> : null}
                Enter demo workspace
              </button>
              <Link
                href="/"
                className="text-[15px] font-medium text-foreground underline underline-offset-4 hover:text-accent"
              >
                Back to overview
              </Link>
            </div>
          </section>
        </div>

        <div className="tone-ink relative hidden bg-background lg:block">
          <MediaSlot slot="mode-sea" sizes="55vw" preload />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#2d2b26]/90 via-[#2d2b26]/10 to-transparent"
          />
          <p className="absolute inset-x-0 bottom-0 max-w-[34rem] px-10 pb-10 font-serif text-[16px] leading-6 text-foreground">
            Inside, a plain working surface: Overview, Ask CarbonSage,
            Integrations, Artifacts, Report, Shipments, Suppliers and Scenarios.
          </p>
        </div>
      </main>
    </PublicSurface>
  );
}
