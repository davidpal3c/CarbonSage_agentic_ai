"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChartNoAxesCombined,
  ChevronUp,
  Files,
  LayoutDashboard,
  Leaf,
  LogOut,
  MessageSquareText,
  Moon,
  Plug,
  Route,
  Sun,
  Truck,
} from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import ChatInterface from "@/app/components/chat_ui/ChatInterface";
import { runWorkspaceAgentAction } from "@/app/dashboard/agent-actions";
import { useTheme } from "@/app/utils/contexts/ThemeContext";

export type Quota = { used: number; limit: number };

export type WorkspaceSession = {
  workspace_id: string;
  expires_at: number;
  quotas: Record<string, Quota>;
  retention: { expires_at: number; policy: string };
};

type WorkspaceContextValue = {
  session: WorkspaceSession;
  refreshSession: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const navigation = [
  {
    label: "Ask CarbonSage",
    href: "/dashboard/agent",
    icon: MessageSquareText,
  },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  { label: "Artifacts", href: "/dashboard/artifacts", icon: Files },
  { label: "Shipments", href: "/dashboard/shipments", icon: Truck },
  {
    label: "Suppliers",
    href: "/dashboard/evidence",
    icon: Building2,
  },
  { label: "Scenarios", href: "/dashboard/scenarios", icon: Route },
  { label: "Report", href: "/dashboard/report", icon: ChartNoAxesCombined },
];

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used inside the workspace shell.");
  }
  return value;
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme, mounted } = useTheme();
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const refreshSession = useCallback(async () => {
    const response = await fetch(`${getBackendUrl()}/demo/session`, {
      credentials: "include",
    });
    if (response.status === 401) {
      router.replace("/login");
      throw new Error("The workspace session is no longer active.");
    }
    if (!response.ok) {
      throw new Error("The workspace could not be loaded.");
    }
    setSession((await response.json()) as WorkspaceSession);
  }, [router]);

  useEffect(() => {
    function closeProfile(event: MouseEvent) {
      if (
        profileRef.current &&
        event.target instanceof Node &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    fetch(`${getBackendUrl()}/demo/session`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok) {
          throw new Error("The workspace could not be loaded.");
        }
        return (await response.json()) as WorkspaceSession;
      })
      .then((workspace) => {
        if (workspace && isCurrent) setSession(workspace);
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The workspace could not be loaded.",
          );
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [router]);

  async function leaveWorkspace() {
    try {
      await fetch(`${getBackendUrl()}/demo/session`, {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-red-800">
          {error}
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading private workspace…
      </main>
    );
  }

  return (
    <WorkspaceContext.Provider value={{ session, refreshSession }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[100rem] flex-col overflow-x-clip lg:flex-row">
        <aside className="sticky top-0 z-40 flex border-b border-border bg-card/95 px-4 py-4 backdrop-blur lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4 lg:block">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted text-accent">
                  <Leaf aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <Link
                    href="/"
                    className="text-lg font-bold tracking-tight text-primary"
                  >
                    CarbonSage
                  </Link>
                  <p className="text-xs text-muted-foreground">Workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={leaveWorkspace}
                className="shrink-0 text-xs font-semibold text-primary hover:text-accent lg:hidden"
              >
                Sign out
              </button>
            </div>

            <nav
              aria-label="Workspace navigation"
              className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0"
            >
              {navigation.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    onClick={() => setProfileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition lg:flex ${
                      active
                        ? "bg-primary font-semibold text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-primary"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div ref={profileRef} className="relative mt-6 hidden lg:block">
            {profileOpen ? (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xl">
                <button
                  type="button"
                  onClick={toggleTheme}
                  disabled={!mounted}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-primary transition hover:bg-muted disabled:opacity-50"
                >
                  {theme === "dark" ? (
                    <Sun aria-hidden="true" className="h-4 w-4 text-accent" />
                  ) : (
                    <Moon aria-hidden="true" className="h-4 w-4 text-accent" />
                  )}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <button
                  type="button"
                  onClick={leaveWorkspace}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-primary transition hover:bg-muted"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4 text-accent" />
                  Sign out
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              aria-expanded={profileOpen}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:border-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">
                DW
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-primary">
                  Demo Workspace
                </span>
                <span className="block text-xs text-muted-foreground">
                  Temporary session
                </span>
              </span>
              <ChevronUp
                aria-hidden="true"
                className={`h-4 w-4 text-muted-foreground transition ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-background text-primary">
          {children}
        </main>
        {pathname === "/dashboard/agent" ? null : (
          <ChatInterface key={pathname} onAction={runWorkspaceAgentAction} />
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
