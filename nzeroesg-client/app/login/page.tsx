"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { getBackendUrl } from "@/app/api/urls";
import BrandMark from "@/app/components/BrandMark";
import BrandWordmark from "@/app/components/BrandWordmark";
import MediaSlot from "@/app/components/MediaSlot";
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
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-[1680px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col px-4 py-6 md:px-10 lg:py-9">
          <Link
            href="/"
            aria-label="CarbonSage home"
            className="flex w-fit items-center gap-2.5 text-[17px]"
          >
            <BrandMark className="h-7 w-7" />
            <BrandWordmark />
          </Link>

          <section className="my-auto max-w-xl py-14">
            <p className="label-mono mb-5 text-tertiary">Current demo</p>
            <h1 className="font-display mb-5 text-[clamp(2.25rem,4.6vw,3.5rem)] text-foreground">
              Enter the demo workspace
            </h1>
            <p className="mb-8 max-w-[46ch] text-[17px] leading-7 text-muted-foreground">
              A private, short-lived workspace is created for your visit. Use it
              to upload data, review evidence, and try CarbonSage. The demo
              covers freight and transportation suppliers, and you can start
              from a fictional dataset or your own files.
            </p>

            <dl className="mb-8 border-t-[1.5px] border-foreground">
              {[
                ["24 hours", "workspace retention"],
                ["Private", "isolated workspace"],
                ["No account", "start immediately"],
              ].map(([term, detail]) => (
                <div
                  key={term}
                  className="flex items-baseline justify-between gap-4 border-b border-border py-3"
                >
                  <dt className="font-bold">{term}</dt>
                  <dd className="label-mono text-muted-foreground">{detail}</dd>
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
                className="inline-flex min-h-12 items-center gap-2 bg-secondary px-5 text-[15px] font-semibold text-white transition-colors hover:bg-secondary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {isEntering ? <Spinner /> : null}
                Enter demo workspace
              </button>
              <Link
                href="/"
                className="text-[15px] font-semibold text-foreground underline underline-offset-4 hover:text-accent"
              >
                Back to overview
              </Link>
            </div>
          </section>
        </div>

        <div className="hidden border-l-[1.5px] border-foreground lg:block">
          <MediaSlot
            slot="hero-operations-environment"
            sizes="55vw"
            eager
            className="min-h-screen"
          />
        </div>
      </div>
    </main>
  );
}
