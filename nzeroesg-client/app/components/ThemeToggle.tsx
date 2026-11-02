"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/app/utils/contexts/ThemeContext";

const buttonClass =
  "flex h-10 w-10 shrink-0 items-center justify-center border-[1.5px] border-foreground text-foreground transition-colors hover:bg-foreground hover:text-background";

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button
        className={`${buttonClass} opacity-50`}
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
      className={buttonClass}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-[18px] w-[18px]" />
      ) : (
        <Moon aria-hidden="true" className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
