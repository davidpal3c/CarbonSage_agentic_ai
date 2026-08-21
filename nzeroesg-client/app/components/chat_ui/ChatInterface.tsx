"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Database, Leaf, Plus, Trash2, Upload, X } from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import { LoadingState, Spinner } from "@/app/components/Spinner";
import type {
  AgentAvailability,
  AgentConversation,
  AgentHealth,
  AgentResponseEnvelope,
  AgentUsage,
  ApiError,
  ConversationDetailResponse,
  ConversationListResponse,
  MessageExchangeResponse,
  SuggestionsBlock,
  UiMessage,
} from "@/app/types/chat";
import AgentDetailsPanel from "./AgentDetailsPanel";
import ChatInput from "./ChatInput";
import { LoadingIndicator } from "./LoadingIndicator";
import StructuredResponse from "./StructuredResponse";
import {
  type DemoDataStatus,
  useWorkspaceDataStore,
} from "@/app/dashboard/workspace-data-store";

interface ChatInterfaceProps {
  initialOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onAction?: (actionId: string, artifactId: string | null) => Promise<void>;
  presentation?: "launcher" | "panel";
  navigationKey?: string;
  onUsageChange?: () => Promise<void>;
}

const statusLabels: Record<AgentAvailability, string> = {
  checking: "Checking",
  available: "Online",
  disabled: "Not configured",
  unreachable: "Unavailable",
};

const suggestedPrompts = [
  "Compare the current freight baseline with rail.",
  "Across current shipments, which transport mode has the highest carbon footprint, and which supplier contributes most?",
  "Recommend the most carbon-efficient supplier for a 1008 kg shipment from Toronto to Vancouver.",
  "Show the monthly emissions trend by transport mode.",
];

function demoDataReadyMessage(data: DemoDataStatus): UiMessage {
  const options: SuggestionsBlock["options"] = [];
  if (data.shipment_count > 0) {
    options.push(
      {
        label: "Find the largest footprint",
        prompt:
          "Across current shipments, which transport mode has the highest carbon footprint, and which supplier contributes most?",
      },
      {
        label: "Compare with rail",
        prompt: "Compare the current freight baseline with rail.",
      },
      {
        label: "View the emissions trend",
        prompt: "Show the monthly emissions trend by transport mode.",
      },
    );
  }
  if (data.evidence_document_count > 0) {
    options.push({
      label: "Review supplier evidence",
      prompt:
        "Which suppliers have cited disclosure evidence, and where are the most important evidence gaps?",
    });
  }

  const now = new Date();
  const summary = [
    `${data.supplier_count} supplier${data.supplier_count === 1 ? "" : "s"}`,
    `${data.shipment_count} shipment${data.shipment_count === 1 ? "" : "s"}`,
    `${data.evidence_document_count} cited document${data.evidence_document_count === 1 ? "" : "s"}`,
  ].join(", ");
  const response = {
    schema_version: "1.0",
    response_id: crypto.randomUUID(),
    policy_version: "1.0",
    evidence_status: "not_required",
    processing_time_ms: 0,
    generated_at: now.toISOString(),
    blocks: [
      {
        type: "text",
        text: `Demo data is ready: ${summary}. Choose a next step or ask your own question.`,
      },
      ...(options.length
        ? [
            {
              type: "suggestions" as const,
              title: "Explore the demo workspace",
              options,
            },
          ]
        : []),
    ],
  } satisfies AgentResponseEnvelope;

  return {
    id: crypto.randomUUID(),
    content: `Demo data is ready: ${summary}.`,
    role: "assistant",
    timestamp: now,
    response,
  };
}

async function apiDetail(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiError | null;
  return payload?.detail ?? fallback;
}

function toUiMessage(message: ConversationDetailResponse["messages"][number]) {
  return {
    id: message.message_id,
    content: message.content,
    role: message.role,
    timestamp: new Date(message.created_at),
    response: message.response ?? undefined,
  } satisfies UiMessage;
}

export default function ChatInterface({
  initialOpen = false,
  onOpenChange,
  onAction,
  presentation = "launcher",
  navigationKey,
  onUsageChange,
}: ChatInterfaceProps) {
  const isPanel = presentation === "panel";
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<AgentConversation | null>(null);
  const [toolEvents, setToolEvents] = useState<
    ConversationDetailResponse["tool_events"]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [isOpen, setIsOpen] = useState(initialOpen || isPanel);
  const [assistantStatus, setAssistantStatus] =
    useState<AgentAvailability>("checking");
  const [conversationReady, setConversationReady] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [agentUsage, setAgentUsage] = useState<AgentUsage | null>(null);
  const demoData = useWorkspaceDataStore((state) => state.demoData);
  const [isLoadingDemoData, setIsLoadingDemoData] = useState(false);
  const conversationId = useRef<string | null>(null);
  const messageElements = useRef(new Map<string, HTMLElement>());
  const pendingScrollTarget = useRef<string | null>(null);
  const previousNavigationKey = useRef(navigationKey);

  const applyConversationDetail = useCallback(
    (detail: ConversationDetailResponse) => {
      conversationId.current = detail.conversation.conversation_id;
      setActiveConversation(detail.conversation);
      setToolEvents(detail.tool_events);
      setMessages(detail.messages.map(toUiMessage));
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversation_id === detail.conversation.conversation_id
            ? detail.conversation
            : conversation,
        ),
      );
    },
    [],
  );

  const loadConversation = useCallback(
    async (id: string, signal?: AbortSignal) => {
      const response = await fetch(
        `${getBackendUrl()}/agent/conversations/${id}`,
        { credentials: "include", signal },
      );
      if (!response.ok) {
        throw new Error(
          await apiDetail(
            response,
            "Conversation history could not be loaded.",
          ),
        );
      }
      const detail = (await response.json()) as ConversationDetailResponse;
      applyConversationDetail(detail);
      return detail;
    },
    [applyConversationDetail],
  );

  const createConversation = useCallback(async () => {
    const createResponse = await fetch(
      `${getBackendUrl()}/agent/conversations`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Decision ${conversations.length + 1}` }),
      },
    );
    if (!createResponse.ok) {
      throw new Error(
        await apiDetail(createResponse, "A conversation could not be created."),
      );
    }
    const created = (await createResponse.json()) as AgentConversation;
    conversationId.current = created.conversation_id;
    setActiveConversation(created);
    setConversations((current) => [
      created,
      ...current.filter(
        (conversation) =>
          conversation.conversation_id !== created.conversation_id,
      ),
    ]);
    setMessages([]);
    setToolEvents([]);
    setControlError(null);
    return created.conversation_id;
  }, [conversations.length]);

  async function ensureConversation() {
    if (conversationId.current) return conversationId.current;
    return createConversation();
  }

  async function refreshToolActivity(id: string) {
    const response = await fetch(
      `${getBackendUrl()}/agent/conversations/${id}`,
      { credentials: "include" },
    );
    if (!response.ok) return;
    const detail = (await response.json()) as ConversationDetailResponse;
    setToolEvents(detail.tool_events);
    setActiveConversation(detail.conversation);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.conversation_id === detail.conversation.conversation_id
          ? detail.conversation
          : conversation,
      ),
    );
  }

  const refreshAssistantAvailability = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`${getBackendUrl()}/agent/health`, {
          credentials: "include",
          signal,
        });
        if (!response.ok) throw new Error("Agent health is unavailable.");
        const health = (await response.json()) as AgentHealth;
        setAssistantStatus(health.available ? "available" : "disabled");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setAssistantStatus("unreachable");
      }
    },
    [],
  );

  const refreshAgentUsage = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${getBackendUrl()}/agent/usage`, {
        credentials: "include",
        signal,
      });
      if (!response.ok) return;
      setAgentUsage((await response.json()) as AgentUsage);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      // Usage metering is supplementary and must never disable the assistant.
    }
  }, []);

  async function handleSendMessage(content: string) {
    let responseReceived = false;
    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      content,
      role: "user",
      timestamp: new Date(),
    };
    pendingScrollTarget.current = userMessage.id;
    setMessages((current) => [...current, userMessage]);
    setIsLoading(true);

    try {
      const activeConversationId = await ensureConversation();
      const response = await fetch(
        `${getBackendUrl()}/agent/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      if (!response.ok) {
        if (response.status === 503) setAssistantStatus("disabled");
        throw new Error(
          await apiDetail(
            response,
            "The agent request could not be completed.",
          ),
        );
      }
      const exchange = (await response.json()) as MessageExchangeResponse;
      const assistant = exchange.assistant_message;
      setMessages((current) => [
        ...current,
        {
          id: assistant.message_id,
          content: assistant.content,
          role: "assistant",
          timestamp: new Date(assistant.created_at),
          response: assistant.response ?? undefined,
        },
      ]);
      responseReceived = true;
      setIsLoading(false);
      void Promise.allSettled([
        refreshToolActivity(activeConversationId),
        onUsageChange?.() ?? Promise.resolve(),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          content:
            error instanceof Error
              ? error.message
              : "CarbonSage is temporarily unavailable.",
          role: "assistant",
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      void refreshAgentUsage();
      if (!responseReceived) setIsLoading(false);
    }
  }

  async function handleNewConversation() {
    setIsSwitchingConversation(true);
    try {
      await createConversation();
    } catch (error) {
      setControlError(
        error instanceof Error
          ? error.message
          : "A conversation could not be created.",
      );
    } finally {
      setIsSwitchingConversation(false);
    }
  }

  async function handleSelectConversation(id: string) {
    if (!id || id === conversationId.current) return;
    setIsSwitchingConversation(true);
    setControlError(null);
    try {
      await loadConversation(id);
    } catch (error) {
      setControlError(
        error instanceof Error
          ? error.message
          : "Conversation history could not be loaded.",
      );
    } finally {
      setIsSwitchingConversation(false);
    }
  }

  async function handleCloseConversation() {
    const id = conversationId.current;
    if (!id || !window.confirm("Close this conversation?")) return;

    setIsSwitchingConversation(true);
    setControlError(null);
    try {
      const response = await fetch(
        `${getBackendUrl()}/agent/conversations/${id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        throw new Error(
          await apiDetail(response, "The conversation could not be closed."),
        );
      }
      const remaining = conversations.filter(
        (conversation) => conversation.conversation_id !== id,
      );
      setConversations(remaining);
      if (remaining[0]) {
        await loadConversation(remaining[0].conversation_id);
      } else {
        conversationId.current = null;
        setActiveConversation(null);
        setMessages([]);
        setToolEvents([]);
      }
    } catch (error) {
      setControlError(
        error instanceof Error
          ? error.message
          : "The conversation could not be closed.",
      );
    } finally {
      setIsSwitchingConversation(false);
    }
  }

  async function handleAgentAction(
    actionId: string,
    artifactId: string | null,
  ) {
    if (!onAction) throw new Error("This workspace action is not available.");
    const loadsDemoData = actionId === "workspace.load_demo_data";
    if (loadsDemoData) {
      setIsLoadingDemoData(true);
      setControlError(null);
    }
    try {
      await onAction(actionId, artifactId);
      if (loadsDemoData) {
        const loaded = useWorkspaceDataStore.getState().demoData;
        if (!loaded?.has_artifacts) {
          throw new Error(
            "Demo data finished loading without any workspace artifacts.",
          );
        }
        setMessages((current) => [...current, demoDataReadyMessage(loaded)]);
        setIsLoadingDemoData(false);
        void Promise.allSettled([
          refreshAssistantAvailability(),
          refreshAgentUsage(),
          onUsageChange?.() ?? Promise.resolve(),
        ]);
      }
    } catch (error) {
      if (loadsDemoData) {
        setControlError(
          error instanceof Error
            ? error.message
            : "Demo data could not be loaded.",
        );
      }
      throw error;
    } finally {
      if (loadsDemoData) setIsLoadingDemoData(false);
    }
  }

  async function handleLoadDemoData() {
    try {
      await handleAgentAction("workspace.load_demo_data", null);
    } catch {
      // The shared action handler exposes the failure in the chat toolbar.
    }
  }

  function handleToggleChat(newState: boolean) {
    setIsOpen(newState);
    onOpenChange?.(newState);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function initialize() {
      await Promise.allSettled([
        refreshAssistantAvailability(controller.signal),
        refreshAgentUsage(controller.signal),
      ]);

      try {
        const listResponse = await fetch(
          `${getBackendUrl()}/agent/conversations`,
          { credentials: "include", signal: controller.signal },
        );
        if (!listResponse.ok) {
          throw new Error(
            await apiDetail(listResponse, "Conversations could not be loaded."),
          );
        }
        const existing =
          (await listResponse.json()) as ConversationListResponse;
        setConversations(existing.conversations);
        if (existing.conversations[0]) {
          await loadConversation(
            existing.conversations[0].conversation_id,
            controller.signal,
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setControlError(
          error instanceof Error
            ? error.message
            : "Conversations could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setConversationReady(true);
      }
    }

    void initialize();
    return () => controller.abort();
  }, [
    loadConversation,
    refreshAgentUsage,
    refreshAssistantAvailability,
  ]);

  useEffect(() => {
    if (
      !isPanel &&
      previousNavigationKey.current !== undefined &&
      previousNavigationKey.current !== navigationKey
    ) {
      setIsOpen(false);
      onOpenChange?.(false);
    }
    previousNavigationKey.current = navigationKey;
  }, [isPanel, navigationKey, onOpenChange]);

  useEffect(() => {
    const targetId = pendingScrollTarget.current;
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      messageElements.current.get(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      pendingScrollTarget.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  const latestResponse = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.response)
        ?.response ?? null,
    [messages],
  );
  const inputDisabled =
    isLoading ||
    isSwitchingConversation ||
    !conversationReady ||
    assistantStatus !== "available";
  const quotaExhausted = agentUsage?.questions_remaining === 0;
  const interactionDisabled =
    inputDisabled || quotaExhausted || isLoadingDemoData;
  const inputPlaceholder =
    assistantStatus === "checking"
      ? "Checking availability…"
      : !conversationReady || isSwitchingConversation
        ? "Loading conversation…"
        : assistantStatus === "available"
          ? quotaExhausted
            ? "Daily question allowance used; available again at 00:00 UTC"
            : "Ask about this workspace…"
          : "CarbonSage is not available in this environment";
  const showInterface =
    isPanel || (previousNavigationKey.current === navigationKey && isOpen);

  return (
    <div>
      {showInterface ? (
        <section
          role={isPanel ? "region" : "dialog"}
          aria-modal={isPanel ? undefined : "false"}
          aria-labelledby="carbonsage-agent-title"
          className={
            isPanel
              ? "flex h-[min(50rem,calc(100vh-11rem))] min-h-[38rem] w-full flex-col overflow-hidden rounded-2xl border border-border bg-chat-surface shadow-sm"
              : "fixed inset-x-3 bottom-3 z-50 flex h-[min(46rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-chat-surface shadow-2xl sm:left-auto sm:right-4 sm:w-[min(48rem,calc(100vw-2rem))]"
          }
        >
          <header className="flex items-start justify-between gap-4 border-b border-border bg-chat-surface px-5 py-4">
            <div>
              <h2
                id="carbonsage-agent-title"
                className="font-semibold text-primary"
              >
                CarbonSage
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Decisions grounded in this workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              {agentUsage ? (
                <span
                  className="inline-flex rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  title={`${agentUsage.questions_used} of ${agentUsage.question_limit} questions used today`}
                >
                  {agentUsage.questions_remaining} left ·{" "}
                  {agentUsage.spend_usd > 0 && agentUsage.spend_usd < 0.01
                    ? "<1¢"
                    : `$${agentUsage.spend_usd.toFixed(2)}`}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    assistantStatus === "available"
                      ? "bg-accent"
                      : assistantStatus === "checking"
                        ? "animate-pulse bg-amber-500"
                        : "bg-zinc-400"
                  }`}
                />
                {statusLabels[assistantStatus]}
              </span>
              {isPanel ? null : (
                <button
                  type="button"
                  onClick={() => handleToggleChat(false)}
                  aria-label="Close CarbonSage"
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-primary"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
            </div>
          </header>

          {isPanel ? (
            <div className="border-b border-border bg-chat-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="agent-conversation" className="sr-only">
                  Conversation
                </label>
                <select
                  id="agent-conversation"
                  value={activeConversation?.conversation_id ?? ""}
                  onChange={(event) =>
                    void handleSelectConversation(event.target.value)
                  }
                  disabled={isSwitchingConversation || !conversations.length}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-primary disabled:text-muted-foreground sm:min-w-56"
                >
                  {!conversations.length ? (
                    <option value="">No saved conversations</option>
                  ) : null}
                  {conversations.map((conversation) => (
                    <option
                      key={conversation.conversation_id}
                      value={conversation.conversation_id}
                    >
                      {conversation.title}
                    </option>
                  ))}
                </select>
                {isSwitchingConversation ? (
                  <Spinner label="Updating conversation" />
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleNewConversation()}
                  disabled={
                    isSwitchingConversation ||
                    conversations.length >= 3 ||
                    assistantStatus !== "available"
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  New
                </button>
                <button
                  type="button"
                  onClick={() => void handleCloseConversation()}
                  disabled={isSwitchingConversation || !activeConversation}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Close
                </button>
              </div>
              {controlError ? (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {controlError}
                </p>
              ) : null}
            </div>
          ) : null}

          {isPanel ? (
            <details className="border-b border-border bg-muted/55 lg:hidden">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">
                Response details
                {latestResponse
                  ? ` · ${latestResponse.processing_time_ms} ms`
                  : ""}
              </summary>
              <AgentDetailsPanel
                availability={assistantStatus}
                conversation={activeConversation}
                response={latestResponse}
                toolEvents={toolEvents}
                usage={agentUsage}
                className="max-h-64 border-l-0 p-4"
                showTitle={false}
              />
            </details>
          ) : null}

          <div
            className={`min-h-0 flex-1 ${
              isPanel
                ? "flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]"
                : "flex flex-col"
            }`}
          >
            <div className="flex min-h-0 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-chat-surface px-4 py-5 sm:px-5">
                {isSwitchingConversation ? (
                  <LoadingState label="Loading conversation" />
                ) : !messages.length && !isLoading ? (
                  <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-accent">
                      <Leaf aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-primary">
                      {demoData && !demoData.has_artifacts
                        ? "Start with demo data or bring your own"
                        : "What would you like to review?"}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {demoData && !demoData.has_artifacts
                        ? "This workspace is empty. Load 24 fictional suppliers, cited disclosures, and a shipment baseline, or upload CSV, XLSX, PDF, or TXT files."
                        : "Ask about workspace files, supplier evidence, emissions, scenarios, or report data."}
                    </p>
                    {demoData && !demoData.has_artifacts ? (
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleLoadDemoData()}
                          disabled={!onAction || isLoadingDemoData}
                          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-secondary/85 disabled:opacity-50"
                        >
                          {isLoadingDemoData ? (
                            <Spinner />
                          ) : (
                            <Database aria-hidden="true" className="h-4 w-4" />
                          )}
                          Load demo data
                        </button>
                        <Link
                          href="/dashboard/shipments"
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-primary transition hover:border-accent"
                        >
                          <Upload aria-hidden="true" className="h-4 w-4" />
                          Upload your own
                        </Link>
                      </div>
                    ) : assistantStatus === "available" && conversationReady ? (
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {suggestedPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => void handleSendMessage(prompt)}
                            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-primary transition hover:border-accent"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {messages.map((message) => (
                  <article
                    key={message.id}
                    ref={(element) => {
                      if (element)
                        messageElements.current.set(message.id, element);
                      else messageElements.current.delete(message.id);
                    }}
                    data-message-id={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`min-w-0 max-w-[94%] rounded-2xl px-4 py-3 sm:max-w-[88%] ${
                        message.role === "user"
                          ? "bg-user-message text-primary"
                          : message.isError
                            ? "border border-red-300 bg-red-50 text-red-900"
                            : "border border-border bg-transparent text-primary shadow-sm"
                      }`}
                    >
                      <p className="mb-2 text-xs font-semibold">
                        {message.role === "user" ? "You" : "CarbonSage"}
                      </p>
                      {message.response ? (
                        <StructuredResponse
                          response={message.response}
                          onAction={onAction ? handleAgentAction : undefined}
                          onPrompt={handleSendMessage}
                          promptDisabled={interactionDisabled}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-6">
                          {message.content}
                        </p>
                      )}
                      <p className="mt-3 text-[11px] opacity-60">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </article>
                ))}
                {isLoading ? <LoadingIndicator /> : null}
              </div>

              <ChatInput
                sendMessage={handleSendMessage}
                disabled={interactionDisabled}
                placeholder={inputPlaceholder}
              />
            </div>

            {isPanel ? (
              <AgentDetailsPanel
                availability={assistantStatus}
                conversation={activeConversation}
                response={latestResponse}
                toolEvents={toolEvents}
                usage={agentUsage}
                className="hidden lg:block"
              />
            ) : null}
          </div>
        </section>
      ) : isPanel ? null : (
        <button
          type="button"
          onClick={() => handleToggleChat(true)}
          aria-label="Open CarbonSage"
          className="group fixed bottom-4 right-4 z-50 rounded-full border border-border bg-primary p-4 text-background shadow-lg transition hover:-translate-y-0.5 hover:border-accent"
        >
          <Leaf
            aria-hidden="true"
            className="h-6 w-6 transition-transform group-hover:scale-105"
          />
        </button>
      )}
    </div>
  );
}
