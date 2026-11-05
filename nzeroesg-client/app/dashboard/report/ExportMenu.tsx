"use client";

import { ChevronDown, FileText, Table2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Spinner } from "@/app/components/Spinner";
import { buttonSecondary } from "@/app/dashboard/workspace-ui";

export type ExportFormat = "pdf" | "csv";

const options: {
  format: ExportFormat;
  label: string;
  hint: string;
  Icon: typeof FileText;
}[] = [
  {
    format: "pdf",
    label: "PDF report",
    hint: "Charts, tables and methodology",
    Icon: FileText,
  },
  {
    format: "csv",
    label: "CSV data",
    hint: "Figures for spreadsheets",
    Icon: Table2,
  },
];

/**
 * One Export control with PDF and CSV. A disclosure menu: the button opens it
 * (click, Enter, Space or the arrow keys), arrows/Home/End move between items,
 * Escape closes and returns focus to the button, and Tab or an outside click
 * closes it. While a download runs the button is busy and the page announces
 * the result.
 */
export default function ExportMenu({
  busyFormat,
  csvDisabled,
  onExport,
}: {
  busyFormat: ExportFormat | null;
  csvDisabled: boolean;
  onExport: (format: ExportFormat) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const busy = busyFormat !== null;

  function openMenu(focusIndex: number) {
    setOpen(true);
    // The items mount on the next render.
    requestAnimationFrame(() => items.current[focusIndex]?.focus());
  }

  function closeMenu(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(options.length - 1);
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const current = items.current.findIndex(
      (item) => item === document.activeElement,
    );
    const move = (index: number) => {
      event.preventDefault();
      items.current[(index + options.length) % options.length]?.focus();
    };
    if (event.key === "ArrowDown") move(current + 1);
    else if (event.key === "ArrowUp") move(current - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(options.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") closeMenu(false);
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-busy={busy}
        aria-disabled={busy}
        onClick={() => {
          // aria-disabled, not disabled: focus stays on the button while busy.
          if (busy) return;
          if (open) closeMenu(false);
          else openMenu(0);
        }}
        onKeyDown={onTriggerKeyDown}
        className={`${buttonSecondary} border-tertiary text-tertiary aria-disabled:cursor-wait aria-disabled:opacity-70`}
      >
        {busy ? <Spinner /> : null}
        {busy ? `Preparing ${busyFormat?.toUpperCase()}` : "Export"}
        {busy ? null : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Export report"
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-card p-1"
        >
          {options.map(({ format, label, hint, Icon }, index) => {
            const unavailable = format === "csv" && csvDisabled;
            return (
              <button
                key={format}
                ref={(node) => {
                  items.current[index] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={unavailable}
                onClick={() => {
                  if (unavailable) return;
                  closeMenu(true);
                  onExport(format);
                }}
                className="flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left text-primary hover:bg-muted focus-visible:bg-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              >
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-tertiary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    {unavailable ? "Needs shipment data" : hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
