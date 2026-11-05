"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import BrandLockup from "@/app/components/BrandLockup";
import BrandWordmark from "@/app/components/BrandWordmark";

const navigation = [
  { name: "How it works", href: "#how" },
  { name: "Freight demo", href: "#lens" },
  { name: "Trust and limits", href: "#trust" },
  { name: "Product", href: "#product" },
];

const navLink =
  "rail-label text-muted-foreground transition-colors hover:text-foreground";

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="tone-ink sticky top-0 z-40 border-b border-spine bg-background text-foreground">
      <div className="relative grid h-[62px] grid-cols-[var(--rail)_minmax(0,1fr)]">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-[var(--rail)] w-px bg-spine"
        />
        <Link
          href="/"
          aria-label="CarbonSage home"
          className="flex items-center justify-center gap-2.5 text-[17px] lg:justify-start lg:pl-10"
        >
          <span className="lg:hidden">
            <BrandLockup variant="mark" />
          </span>
          <span className="hidden lg:block">
            <BrandLockup />
          </span>
        </Link>

        <div className="flex min-w-0 items-stretch">
          <Link
            href="/"
            tabIndex={-1}
            aria-hidden="true"
            className="flex items-center pl-4 text-[16px] md:pl-8 lg:hidden"
          >
            <BrandWordmark className="text-[16px]" />
          </Link>

          <nav
            aria-label="Primary"
            className="ml-5 hidden items-center gap-7 lg:flex"
          >
            {navigation.map((item) => (
              <a key={item.href} href={item.href} className={navLink}>
                <span aria-hidden="true" className="mr-2 text-muted-foreground">
                  /
                </span>
                {item.name}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-stretch">
            <Link
              href="/login"
              className="rail-label flex items-center border-l border-spine bg-foreground px-4 text-background transition-colors hover:bg-foreground/85 md:px-7"
            >
              Try the demo
            </Link>
            <button
              ref={menuButton}
              type="button"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
              className="flex w-12 shrink-0 items-center justify-center border-l border-spine text-foreground hover:bg-foreground/10 lg:hidden"
            >
              {open ? (
                <X aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-menu"
          aria-label="Primary"
          className="border-t border-spine bg-background pb-4 pl-[calc(var(--rail)+1.25rem)] pr-5 md:pl-[calc(var(--rail)+2rem)] lg:hidden"
        >
          <ul>
            {navigation.map((item) => (
              <li key={item.href} className="border-b border-spine">
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rail-label flex min-h-14 items-center text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mr-2 text-muted-foreground"
                  >
                    /
                  </span>
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
