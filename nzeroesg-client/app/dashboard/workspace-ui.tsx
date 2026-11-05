import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

/**
 * Shared presentation for the workspace work surfaces: one page frame, one
 * header, one card, one metric strip and the standard buttons, so every route
 * shares the compact hierarchy established on Overview. Components here use
 * workspace tokens only; nothing in this file is imported by the public site.
 */

/** Page frame: compact padding, sized to the shell's 48 px top bar. */
export function WorkspacePage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 px-4 py-6 sm:px-[22px] lg:px-8 lg:py-7 ${className}`}
    >
      {children}
    </section>
  );
}

/** Page title (one h1 per route), a one-sentence purpose, and page actions. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = "mb-5",
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`flex flex-wrap items-start justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="label-ui mb-1 text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="text-[1.5625rem] font-semibold tracking-tight text-primary sm:text-[1.875rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-[15px] leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}

export const cardClass = "rounded-lg border border-border bg-card p-[18px]";

/** A bordered surface. Use sparingly: most sections are plain ledgers. */
export function Card<T extends ElementType = "section">({
  as,
  className = "",
  ...props
}: { as?: T; className?: string } & Omit<
  ComponentPropsWithoutRef<T>,
  "as" | "className"
>) {
  const Tag: ElementType = as ?? "section";
  return <Tag className={`${cardClass} ${className}`} {...props} />;
}

/** Buttons: 40 px targets on touch, 36 px with a pointer. */
const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-[13px] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-9";
export const buttonPrimary = `${buttonBase} bg-secondary text-white hover:bg-secondary/85`;
export const buttonSecondary = `${buttonBase} border border-control bg-card text-primary hover:bg-muted`;

/** Small status or category label. */
export const chipClass =
  "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground";

/** Icon tile used at the head of cards and list rows. */
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-tertiary">
      {children}
    </span>
  );
}

export interface Metric {
  label: string;
  value: ReactNode;
  unit?: string;
}

/**
 * A strip of key figures: one bordered row of cells instead of a card each.
 * Values are monospaced and tabular; the unit stays a smaller sibling.
 */
export function MetricStrip({
  items,
  className = "",
}: {
  items: Metric[];
  className?: string;
}) {
  return (
    <dl
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 ${className}`}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`bg-card px-[18px] py-3.5 ${
            items.length % 2 === 1 && index === items.length - 1
              ? "col-span-2 sm:col-span-1"
              : ""
          }`}
        >
          <dt className="text-[13px] text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-mono text-[1.375rem] font-medium leading-tight tabular-nums">
            {item.value}
            {item.unit ? (
              <>
                {" "}
                <span className="whitespace-nowrap text-xs font-normal text-muted-foreground">
                  {item.unit}
                </span>
              </>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A quiet empty or not-yet-available state. */
export function EmptyNotice({
  icon,
  label,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  label?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
      {icon ? <IconTile>{icon}</IconTile> : null}
      {label ? <p className="label-ui mt-3 text-accent">{label}</p> : null}
      <h2 className="mt-1.5 text-[17px] font-semibold text-primary">{title}</h2>
      {children ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          {children}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
