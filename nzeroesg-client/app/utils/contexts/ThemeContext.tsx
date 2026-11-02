"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themeListeners = new Set<() => void>();

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function getClientTheme(): Theme {
  if (typeof document === "undefined") {
    return "light";
  }

  if (document.documentElement.classList.contains("dark")) {
    return "dark";
  }

  try {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch {
    // Fall back to the system preference when storage is unavailable.
  }

  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    // Fall back to light mode when media queries are unavailable.
  }

  return "light";
}

function getServerTheme(): Theme {
  return "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Theme persistence is optional when storage is unavailable.
  }
}

function updateTheme(theme: Theme) {
  applyTheme(theme);
  themeListeners.forEach((listener) => listener());
}

const subscribeToMount = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getClientTheme,
    getServerTheme,
  );
  const mounted = useSyncExternalStore(
    subscribeToMount,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );

  // Hydration renders the server snapshot ("light") first. Applying it would
  // overwrite a saved or system dark preference before it is read, so wait
  // until the client snapshot is live.
  useEffect(() => {
    if (mounted) applyTheme(theme);
  }, [mounted, theme]);

  const toggleTheme = () => {
    updateTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
