"use client";

import { useRouter } from "next/navigation";

import ThemeToggle from "@/app/components/ThemeToggle";
import AboutSection from "@/app/components/page_components/AboutSection";
import HeroSection from "@/app/components/page_components/HeroSection";
import { comingSoonData, featuresData } from "@/app/lib/data";

const navigation = [
  { name: "About", href: "#about" },
  { name: "Baseline", href: "#features" },
  { name: "Roadmap", href: "#roadmap" },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-lg">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <a href="#" className="text-xl font-bold tracking-tight text-primary">
            🌱 CarbonSage
          </a>
          <div className="flex items-center gap-5 text-sm font-semibold">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="hidden text-primary transition hover:text-accent sm:block"
              >
                {item.name}
              </a>
            ))}
            <button
              onClick={() => router.push("/login")}
              className="text-primary transition hover:text-accent"
            >
              Enter demo workspace
            </button>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main>
        <HeroSection onTry={() => router.push("/login")} />
        <AboutSection />

        <section id="features" className="bg-background px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
                Current baseline
              </p>
              <h2 className="text-3xl font-bold text-primary">
                Honest foundations before feature breadth
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {featuresData.map((feature) => (
                <article
                  key={feature.id}
                  className="rounded-xl border border-border bg-muted p-6"
                >
                  <feature.icon className="mb-4 h-7 w-7 text-accent" />
                  <h3 className="mb-2 font-semibold text-primary">
                    {feature.title}
                  </h3>
                  <p className="leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="roadmap"
          className="bg-gradient-to-br from-background via-muted to-background px-6 py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
                Next release track
              </p>
              <h2 className="text-3xl font-bold text-primary">
                From trusted data to embedded intelligence
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {comingSoonData.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-border bg-background p-6 shadow-sm"
                >
                  <item.icon className="mb-4 h-7 w-7 text-accent" />
                  <h3 className="mb-2 font-semibold text-primary">
                    {item.title}
                  </h3>
                  <p className="leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 px-6 py-8 text-center text-sm text-gray-300">
        © {new Date().getFullYear()} CarbonSage · Evidence-grounded Scope 3
        intelligence, wherever decisions happen
      </footer>
    </>
  );
}
