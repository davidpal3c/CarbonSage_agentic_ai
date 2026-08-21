"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { getBackendUrl } from "@/app/api/urls";
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
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-xl sm:p-10">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-primary">
          Enter the demo workspace
        </h1>
        <p className="mb-8 max-w-lg leading-7 text-muted-foreground">
          A private, short-lived workspace is created for your visit. Use it to
          upload data, review evidence, and try CarbonSage.
        </p>

        <div className="mb-8 grid gap-3 text-sm text-primary sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <strong className="block text-base">24 hours</strong>
            <span className="text-muted-foreground">workspace retention</span>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <strong className="block text-base">Private</strong>
            <span className="text-muted-foreground">isolated workspace</span>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <strong className="block text-base">No account</strong>
            <span className="text-muted-foreground">start immediately</span>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error} Check that the API is running and try again.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={enterDemoWorkspace}
            disabled={isEntering}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary/85 disabled:cursor-wait disabled:opacity-60"
          >
            {isEntering ? <Spinner /> : null}
            Enter demo workspace
          </button>
          <Link
            href="/"
            className="text-sm font-semibold text-primary hover:text-accent"
          >
            Back to overview
          </Link>
        </div>
      </section>
    </main>
  );
}
