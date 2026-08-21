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
  ChevronDown,
  CircleHelp,
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
import BrandWordmark from "@/app/components/BrandWordmark";
import { LoadingState } from "@/app/components/Spinner";
import ChatInterface from "@/app/components/chat_ui/ChatInterface";
import { runWorkspaceAgentAction } from "@/app/dashboard/agent-actions";
import { useWorkspaceDataStore } from "@/app/dashboard/workspace-data-store";
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

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof Leaf;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const workspaceNavigation: NavigationItem[] = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  {
    label: "Ask CarbonSage",
    href: "/dashboard/agent",
    icon: MessageSquareText,
  },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "Artifacts", href: "/dashboard/artifacts", icon: Files },
  { label: "Report", href: "/dashboard/report", icon: ChartNoAxesCombined },
];

const simulationNavigation: NavigationItem[] = [
  { label: "Shipments", href: "/dashboard/shipments", icon: Truck },
  { label: "Suppliers", href: "/dashboard/evidence", icon: Building2 },
  { label: "Scenarios", href: "/dashboard/scenarios", icon: Route },
];

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used inside the workspace shell.");
  }
  return value;
}

function NavigationLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-center text-[10px] leading-tight transition lg:min-h-[3.75rem] lg:w-full lg:min-w-0 ${
        active
          ? "bg-secondary/10 font-semibold text-brand-primary"
          : "text-muted-foreground hover:bg-card/80 hover:text-primary"
      }`}
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
      <span>{item.label}</span>
    </Link>
  );
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme, mounted } = useTheme();
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [simulationsOpen, setSimulationsOpen] = useState(true);
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
    const workspace = (await response.json()) as WorkspaceSession;
    useWorkspaceDataStore.getState().setWorkspace(workspace.workspace_id);
    setSession(workspace);
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
        if (workspace && isCurrent) {
          const workspaceData = useWorkspaceDataStore.getState();
          workspaceData.setWorkspace(workspace.workspace_id);
          setSession(workspace);
          void useWorkspaceDataStore
            .getState()
            .ensureDemoData()
            .catch(() => undefined);
        }
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
      useWorkspaceDataStore.getState().resetWorkspace();
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
      <main className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading private workspace" />
      </main>
    );
  }

  const allNavigation = [...workspaceNavigation, ...simulationNavigation];

  return (
    <WorkspaceContext.Provider value={{ session, refreshSession }}>
      <div className="flex min-h-screen w-full flex-col overflow-x-clip bg-background lg:flex-row">
        <aside className="sticky top-0 z-40 flex border-b border-sidebar-border bg-sidebar px-4 py-3 lg:h-screen lg:w-[7.25rem] lg:shrink-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-2 lg:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4 px-1 lg:flex-col lg:justify-center lg:gap-2 lg:px-0 lg:text-center">
              <div className="flex items-center gap-3 lg:flex-col lg:gap-1.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-brand-mark text-brand-primary shadow-sm">
                  <Leaf aria-hidden="true" className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <Link
                    href="/"
                    className="text-base font-bold tracking-tight lg:text-[13px]"
                  >
                    <BrandWordmark />
                  </Link>
                  <p className="text-[11px] text-muted-foreground lg:text-[9px] lg:uppercase lg:tracking-[0.12em]">
                    Workspace
                  </p>
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
              className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden"
            >
              {allNavigation.map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setProfileOpen(false)}
                />
              ))}
            </nav>

            <nav
              aria-label="Workspace navigation"
              className="mt-6 hidden lg:block"
            >
              <p className="text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                Workspace
              </p>
              <div className="mt-1.5 space-y-1">
                {workspaceNavigation.map((item) => (
                  <NavigationLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={() => setProfileOpen(false)}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setSimulationsOpen((current) => !current)}
                aria-expanded={simulationsOpen}
                className="mt-5 flex w-full items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80"
              >
                Simulations
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition ${simulationsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {simulationsOpen ? (
                <div className="mt-1.5 space-y-1">
                  {simulationNavigation.map((item) => (
                    <NavigationLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onNavigate={() => setProfileOpen(false)}
                    />
                  ))}
                </div>
              ) : null}
            </nav>
          </div>

          <div ref={profileRef} className="relative mt-4 hidden lg:block">
            {profileOpen ? (
              <div className="fixed bottom-4 left-[7.75rem] z-[80] w-52 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl">
                <Link
                  href="/dashboard/how-to"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-primary transition hover:bg-muted"
                >
                  <CircleHelp
                    aria-hidden="true"
                    className="h-4 w-4 text-accent"
                  />
                  How to use CarbonSage
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                    setProfileOpen(false);
                  }}
                  disabled={!mounted}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-primary transition hover:bg-muted disabled:opacity-50"
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
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-primary transition hover:bg-muted"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4 text-accent" />
                  Sign out
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              aria-label="Open workspace menu"
              aria-expanded={profileOpen}
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white shadow-sm transition hover:bg-secondary/85"
            >
              DW
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-background text-primary">
          {children}
          <div
            className={
              pathname === "/dashboard/agent"
                ? "px-4 pb-7 sm:px-6 lg:px-10 lg:pb-9"
                : ""
            }
          >
            <ChatInterface
              navigationKey={pathname}
              onUsageChange={refreshSession}
              onAction={runWorkspaceAgentAction}
              presentation={
                pathname === "/dashboard/agent" ? "panel" : "launcher"
              }
            />
          </div>
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}
