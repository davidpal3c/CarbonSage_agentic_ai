"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import BrandMark from "@/app/components/BrandMark";
import BrandWordmark from "@/app/components/BrandWordmark";
import ButtonLink from "@/app/components/ButtonLink";
import ThemeToggle from "@/app/components/ThemeToggle";

const navigation = [
  { name: "How it works", href: "#how" },
  { name: "Freight demo", href: "#lens" },
  { name: "Product", href: "#product" },
  { name: "Trust and limits", href: "#trust" },
];

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
    <header className="sticky top-0 z-40 border-b-[1.5px] border-foreground bg-background">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 md:px-10">
        <Link
          href="/"
          aria-label="CarbonSage home"
          className="flex shrink-0 items-center gap-2.5 text-[14px] sm:text-[17px]"
        >
          <BrandMark className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
          <BrandWordmark />
        </Link>

        <nav aria-label="Primary" className="ml-6 mr-auto hidden gap-7 lg:flex">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="label-mono text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline"
            >
              {item.name}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <ButtonLink
            href="/login"
            className="min-h-11 px-3 max-sm:text-sm sm:px-5"
          >
            Try the demo
          </ButtonLink>
          <button
            ref={menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
            className="flex h-11 w-11 shrink-0 items-center justify-center border-[1.5px] border-foreground text-foreground lg:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-menu"
          aria-label="Primary"
          className="border-t border-border bg-background px-4 pb-4 md:px-10 lg:hidden"
        >
          <ul>
            {navigation.map((item) => (
              <li key={item.href} className="border-b border-border">
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="label-mono flex min-h-14 items-center text-foreground"
                >
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <span className="label-mono text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
