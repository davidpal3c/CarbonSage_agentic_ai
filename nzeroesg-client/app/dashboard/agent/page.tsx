"use client";

import ChatInterface from "@/app/components/chat_ui/ChatInterface";
import { runWorkspaceAgentAction } from "@/app/dashboard/agent-actions";

export default function AgentPage() {
  return (
    <section className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Ask CarbonSage
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Explore your workspace, compare freight decisions, and review the
          sources and calculations behind each answer.
        </p>
      </header>

      <ChatInterface presentation="panel" onAction={runWorkspaceAgentAction} />
    </section>
  );
}
