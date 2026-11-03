"use client";

import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
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
  CircleHelp,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Plug,
  Route,
  Sun,
  Truck,
  X,
} from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import BrandMark from "@/app/components/BrandMark";
import BrandWordmark from "@/app/components/BrandWordmark";
import { LoadingState } from "@/app/components/Spinner";
import ChatInterface from "@/app/components/chat_ui/ChatInterface";
import { runWorkspaceAgentAction } from "@/app/dashboard/agent-actions";
import { ArtifactViewerProvider } from "@/app/dashboard/artifact-viewer-context";
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
  icon: typeof LayoutDashboard;
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

const navigationGroups = [
  { label: "Workspace", items: workspaceNavigation },
  { label: "Simulations", items: simulationNavigation },
];

const howToHref = "/dashboard/how-to";
const drawerId = "workspace-drawer";

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used inside the workspace shell.");
  }
  return value;
}

function currentLabel(pathname: string) {
  if (pathname.startsWith(howToHref)) return "How to use";
  return (
    [...workspaceNavigation, ...simulationNavigation].find((item) =>
      pathname.startsWith(item.href),
    )?.label ?? "Workspace"
  );
}

const itemClass = (active: boolean) =>
  `flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-[15px] transition-colors ${
    active
      ? "border-accent bg-muted font-medium text-foreground"
      : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
  }`;

function WorkspaceNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Workspace navigation" className="space-y-6">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="label-ui mb-2 px-3 text-muted-foreground">
            {group.label}
          </p>
          <ul>
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={itemClass(active)}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ShellUtilities({
  pathname,
  expiresAt,
  onNavigate,
  onSignOut,
}: {
  pathname: string;
  expiresAt: number;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const { theme, toggleTheme, mounted } = useTheme();
  const expires = new Date(expiresAt * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className="border-t border-sidebar-border pt-4">
      <p className="mb-3 px-3 text-[13px] leading-5 text-muted-foreground">
        Temporary demo workspace. Expires {expires}.
      </p>
      <ul>
        <li>
          <Link
            href={howToHref}
            onClick={onNavigate}
            aria-current={pathname.startsWith(howToHref) ? "page" : undefined}
            className={itemClass(pathname.startsWith(howToHref))}
          >
            <CircleHelp aria-hidden="true" className="h-[18px] w-[18px]" />
            How to use CarbonSage
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={toggleTheme}
            disabled={!mounted}
            className={`${itemClass(false)} w-full text-left disabled:opacity-50`}
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" className="h-[18px] w-[18px]" />
            ) : (
              <Moon aria-hidden="true" className="h-[18px] w-[18px]" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={onSignOut}
            className={`${itemClass(false)} w-full text-left`}
          >
            <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </li>
      </ul>
    </div>
  );
}

function Lockup({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="CarbonSage home"
      className="flex items-center gap-2.5 text-[15px]"
    >
      <BrandMark className="h-7 w-7 shrink-0" />
      <BrandWordmark />
    </Link>
  );
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The drawer is open only for the route it was opened on, so any navigation
  // (links, browser back/forward) closes it without an effect.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const [launcherSlot, setLauncherSlot] = useState<HTMLElement | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawerOpen = drawerPath === pathname;

  const closeDrawer = useCallback(() => {
    setDrawerPath(null);
    menuButton.current?.focus();
  }, []);

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
      .then(async (workspace) => {
        if (workspace && isCurrent) {
          const workspaceData = useWorkspaceDataStore.getState();
          workspaceData.setWorkspace(workspace.workspace_id);
          await workspaceData.ensureWorkspaceBootstrap().catch(() => undefined);
          if (isCurrent) setSession(workspace);
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

  // While the drawer is open: lock page scroll, move focus in, close on
  // Escape, and close if the viewport grows to the desktop layout.
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const desktop = window.matchMedia("(min-width: 1024px)");
    function onViewportChange() {
      if (desktop.matches) setDrawerPath(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }
    desktop.addEventListener("change", onViewportChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", onViewportChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDrawer, drawerOpen]);

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !drawer.current) return;
    const focusable = drawer.current.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-red-800"
        >
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

  return (
    <WorkspaceContext.Provider value={{ session, refreshSession }}>
      <ArtifactViewerProvider>
        <div className="flex min-h-screen w-full overflow-x-clip bg-background">
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
            <div className="px-3">
              <Lockup />
            </div>
            <div className="flex-1">
              <WorkspaceNavigation pathname={pathname} />
            </div>
            <ShellUtilities
              pathname={pathname}
              expiresAt={session.expires_at}
              onSignOut={leaveWorkspace}
            />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 print:hidden lg:px-10">
              <button
                ref={menuButton}
                type="button"
                onClick={() => setDrawerPath(pathname)}
                aria-label="Open menu"
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-control text-foreground lg:hidden"
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </button>
              <div className="min-w-0 lg:hidden">
                <Lockup />
              </div>
              <p
                aria-hidden="true"
                className="label-ui hidden text-muted-foreground lg:block"
              >
                Workspace <span className="mx-1">/</span>
                <span className="text-foreground">
                  {currentLabel(pathname)}
                </span>
              </p>
              <div
                ref={setLauncherSlot}
                className="ml-auto flex shrink-0 items-center"
              />
            </div>

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
                  launcherSlot={launcherSlot}
                  presentation={
                    pathname === "/dashboard/agent" ? "panel" : "launcher"
                  }
                />
              </div>
            </main>
          </div>
        </div>

        {drawerOpen ? (
          <div className="fixed inset-0 z-[60] lg:hidden print:hidden">
            <div
              aria-hidden="true"
              onClick={closeDrawer}
              className="absolute inset-0 bg-black/50"
            />
            <div
              ref={drawer}
              id={drawerId}
              role="dialog"
              aria-modal="true"
              aria-label="Workspace menu"
              onKeyDown={trapFocus}
              className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4"
            >
              <div className="flex items-start justify-between px-3">
                <div>
                  <Lockup onClick={closeDrawer} />
                </div>
                <button
                  ref={closeButton}
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close menu"
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-control text-foreground"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1">
                <WorkspaceNavigation
                  pathname={pathname}
                  onNavigate={closeDrawer}
                />
              </div>
              <ShellUtilities
                pathname={pathname}
                expiresAt={session.expires_at}
                onNavigate={closeDrawer}
                onSignOut={leaveWorkspace}
              />
            </div>
          </div>
        ) : null}
      </ArtifactViewerProvider>
    </WorkspaceContext.Provider>
  );
}
