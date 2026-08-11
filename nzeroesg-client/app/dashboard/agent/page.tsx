"use client";

import ChatInterface from "@/app/components/chat_ui/ChatInterface";
import { runWorkspaceAgentAction } from "@/app/dashboard/agent-actions";

export default function AgentPage() {
  return (
    <section className="px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
          Workspace intelligence
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          Decision agent
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          Test CarbonSage against the artifacts, evidence, and deterministic
          calculations in this workspace. Source-backed answers include
          citations, and numeric responses come from validated tools.
        </p>
      </header>

      <ChatInterface presentation="panel" onAction={runWorkspaceAgentAction} />
    </section>
  );
}
