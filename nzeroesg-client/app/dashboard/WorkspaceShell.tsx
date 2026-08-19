"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChartNoAxesCombined,
  Files,
  LayoutDashboard,
  Leaf,
  MessageSquareText,
  Route,
  Truck,
} from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import ChatInterface from "@/app/components/chat_ui/ChatInterface";
import { runWorkspaceAgentAction } from "@/app/dashboard/agent-actions";

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
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Artifacts", href: "/dashboard/artifacts", icon: Files },
  { label: "Shipments", href: "/dashboard/shipments", icon: Truck },
  {
    label: "Suppliers & evidence",
    href: "/dashboard/evidence",
    icon: Building2,
  },
  { label: "Scenarios", href: "/dashboard/scenarios", icon: Route },
  { label: "Report", href: "/dashboard/report", icon: ChartNoAxesCombined },
  { label: "Agent", href: "/dashboard/agent", icon: MessageSquareText },
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
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <aside className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-4 backdrop-blur lg:h-screen lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
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
              Leave workspace
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

          <button
            type="button"
            onClick={leaveWorkspace}
            className="mt-10 hidden text-sm font-semibold text-primary hover:text-accent lg:block"
          >
            Leave workspace
          </button>
        </aside>

        <main className="min-w-0 flex-1 bg-background text-primary">
          {children}
        </main>
        {pathname === "/dashboard/agent" ? null : (
          <ChatInterface onAction={runWorkspaceAgentAction} />
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
