import type { ReactNode } from "react";

/**
 * One public section on the shared grid: a rail column that holds the section
 * index label and a content column, divided by a hairline spine that runs
 * through every section. The label sits in the rail from lg up and above the
 * content below it. Pass tone="ink" for a section that stays dark in both
 * themes.
 */
export default function SpineSection({
  id,
  label,
  labelledBy,
  tone = "default",
  className = "",
  contentClassName = "",
  children,
}: {
  id?: string;
  label?: string;
  labelledBy?: string;
  tone?: "default" | "ink";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`relative scroll-mt-16 bg-background text-foreground ${
        tone === "ink" ? "tone-ink" : ""
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-[var(--rail)] z-10 w-px bg-spine"
      />
      <div className="relative grid grid-cols-[var(--rail)_minmax(0,1fr)]">
        {label ? (
          <p className="rail-label rail-index col-start-2 row-start-1 pb-5 pl-5 pr-5 pt-16 text-foreground md:pl-8 lg:col-start-1 lg:pb-0 lg:pl-10 lg:pr-4 lg:pt-[7.4rem]">
            {label}
          </p>
        ) : null}
        <div
          className={`col-start-2 row-start-2 min-w-0 px-5 md:px-8 lg:row-start-1 lg:px-5 ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
