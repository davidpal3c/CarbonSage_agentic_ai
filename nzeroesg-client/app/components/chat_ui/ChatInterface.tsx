"use client";

import { useEffect, useRef, useState } from "react";
import { Leaf, X } from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import type {
  AgentConversation,
  AgentHealth,
  ApiError,
  ConversationDetailResponse,
  ConversationListResponse,
  MessageExchangeResponse,
  UiMessage,
} from "@/app/types/chat";
import ChatInput from "./ChatInput";
import { LoadingIndicator } from "./LoadingIndicator";
import StructuredResponse from "./StructuredResponse";

interface ChatInterfaceProps {
  initialOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onAction?: (actionId: string, artifactId: string | null) => Promise<void>;
  presentation?: "launcher" | "panel";
}

type AssistantStatus = "checking" | "available" | "disabled" | "unreachable";

const statusLabels: Record<AssistantStatus, string> = {
  checking: "Checking",
  available: "Available",
  disabled: "Disabled",
  unreachable: "Unavailable",
};

async function apiDetail(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiError | null;
  return payload?.detail ?? fallback;
}

function introductionMessage(): UiMessage {
  return {
    id: "agent-introduction",
    content:
      "Ask CarbonSage to inspect workspace artifacts, retrieve cited supplier evidence, calculate freight emissions, compare scenarios, assess data quality, or build decision-report data. Facts and arithmetic come from validated tools; unsupported evidence questions return a limitation.",
    role: "assistant",
    timestamp: new Date(),
  };
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
}: ChatInterfaceProps) {
  const isPanel = presentation === "panel";
  const [messages, setMessages] = useState<UiMessage[]>([
    introductionMessage(),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(initialOpen || isPanel);
  const [assistantStatus, setAssistantStatus] =
    useState<AssistantStatus>("checking");
  const [conversationReady, setConversationReady] = useState(false);
  const conversationId = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function ensureConversation() {
    if (conversationId.current) return conversationId.current;

    const createResponse = await fetch(
      `${getBackendUrl()}/agent/conversations`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "CarbonSage workspace decision" }),
      },
    );
    if (!createResponse.ok) {
      throw new Error(
        await apiDetail(createResponse, "A conversation could not be created."),
      );
    }
    const created = (await createResponse.json()) as AgentConversation;
    conversationId.current = created.conversation_id;
    return created.conversation_id;
  }

  async function handleSendMessage(content: string) {
    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      content,
      role: "user",
      timestamp: new Date(),
    };
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
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          content:
            error instanceof Error
              ? error.message
              : "The CarbonSage agent is temporarily unavailable.",
          role: "assistant",
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggleChat(newState: boolean) {
    setIsOpen(newState);
    onOpenChange?.(newState);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        const healthResponse = await fetch(`${getBackendUrl()}/agent/health`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!healthResponse.ok) throw new Error("Agent health is unavailable.");
        const health = (await healthResponse.json()) as AgentHealth;
        if (!health.available) {
          setAssistantStatus("disabled");
          setConversationReady(true);
          return;
        }

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
        const current = existing.conversations[0];
        if (current) {
          conversationId.current = current.conversation_id;
          const detailResponse = await fetch(
            `${getBackendUrl()}/agent/conversations/${current.conversation_id}`,
            { credentials: "include", signal: controller.signal },
          );
          if (!detailResponse.ok) {
            throw new Error(
              await apiDetail(
                detailResponse,
                "Conversation history could not be loaded.",
              ),
            );
          }
          const detail =
            (await detailResponse.json()) as ConversationDetailResponse;
          if (detail.messages.length) {
            setMessages([
              introductionMessage(),
              ...detail.messages.map(toUiMessage),
            ]);
          }
        }
        setAssistantStatus("available");
        setConversationReady(true);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setAssistantStatus("unreachable");
        }
      }
    }
    void initialize();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const inputDisabled =
    isLoading || !conversationReady || assistantStatus !== "available";
  const inputPlaceholder =
    assistantStatus === "checking"
      ? "Checking agent availability…"
      : !conversationReady
        ? "Loading conversation…"
        : assistantStatus === "available"
          ? "Ask about this workspace…"
          : "Agent is not available in this environment";

  return (
    <div>
      {isOpen ? (
        <section
          role={isPanel ? "region" : "dialog"}
          aria-modal={isPanel ? undefined : "false"}
          aria-labelledby="carbonsage-agent-title"
          className={
            isPanel
              ? "flex h-[min(48rem,calc(100vh-12rem))] min-h-[38rem] w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
              : "fixed inset-x-3 bottom-3 z-50 flex h-[min(46rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:left-auto sm:right-4 sm:w-[min(48rem,calc(100vw-2rem))]"
          }
        >
          <header className="flex items-start justify-between gap-4 border-b border-border bg-muted px-5 py-4">
            <div>
              <h2
                id="carbonsage-agent-title"
                className="font-semibold text-primary"
              >
                CarbonSage decision agent
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Workspace-scoped · typed tools · policy v1.0
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    assistantStatus === "available"
                      ? "bg-emerald-500"
                      : assistantStatus === "checking"
                        ? "animate-pulse bg-amber-500"
                        : "bg-slate-400"
                  }`}
                />
                {statusLabels[assistantStatus]}
              </span>
              {isPanel ? null : (
                <button
                  type="button"
                  onClick={() => handleToggleChat(false)}
                  aria-label="Close CarbonSage agent"
                  className="rounded-full p-1 text-primary transition hover:bg-border"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
            </div>
          </header>

          <div
            className="flex-1 space-y-4 overflow-y-auto bg-muted/40 px-3 py-4 sm:px-5"
            aria-live="polite"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`min-w-0 max-w-[94%] rounded-2xl px-4 py-3 sm:max-w-[88%] ${
                    message.role === "user"
                      ? "bg-secondary text-white"
                      : message.isError
                        ? "border border-red-300 bg-red-50 text-red-900"
                        : "border border-border bg-muted text-primary"
                  }`}
                >
                  <p className="mb-2 text-xs font-semibold">
                    {message.role === "user" ? "You" : "CarbonSage"}
                  </p>
                  {message.response ? (
                    <StructuredResponse
                      response={message.response}
                      onAction={onAction}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {message.content}
                    </p>
                  )}
                  <p className="mt-3 text-[11px] opacity-65">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {message.response
                      ? ` · ${message.response.processing_time_ms} ms · evidence ${message.response.evidence_status.replaceAll("_", " ")}`
                      : ""}
                  </p>
                </div>
              </article>
            ))}
            {isLoading ? <LoadingIndicator /> : null}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            sendMessage={handleSendMessage}
            disabled={inputDisabled}
            placeholder={inputPlaceholder}
          />
        </section>
      ) : isPanel ? null : (
        <button
          type="button"
          onClick={() => handleToggleChat(true)}
          aria-label="Open CarbonSage decision agent"
          className="group fixed bottom-4 right-4 z-50 rounded-full border border-green-700 bg-accent p-4 text-white shadow-lg transition hover:bg-secondary"
        >
          <Leaf
            aria-hidden="true"
            className="h-6 w-6 transition-transform group-hover:scale-110"
          />
        </button>
      )}
    </div>
  );
}
