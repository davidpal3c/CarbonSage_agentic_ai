"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/app/utils/contexts/ThemeContext";

const buttonClass =
  "flex h-10 w-10 shrink-0 items-center justify-center text-foreground transition-colors hover:bg-foreground/10";

export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button
        className={`${buttonClass} opacity-50 ${className}`}
        disabled
        aria-label="Loading theme toggle"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`${buttonClass} ${className}`}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-[18px] w-[18px]" />
      ) : (
        <Moon aria-hidden="true" className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
