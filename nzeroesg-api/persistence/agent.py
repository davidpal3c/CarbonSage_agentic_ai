"""Bounded workspace-scoped persistence for the typed agent runtime."""

from __future__ import annotations

import threading
from contextlib import closing
from datetime import UTC, datetime
from typing import Any, Protocol

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:  # pragma: no cover - dependency is present in deployed/runtime installs
    psycopg = None
    Jsonb = None

from domain.agent.models import (
    AGENT_POLICY_VERSION,
    AgentConversation,
    AgentMessage,
    AgentResponseEnvelope,
    CitationRecord,
    ConversationDetail,
    ConversationStatus,
    MessageRole,
    ToolEvent,
    ToolEventStatus,
)
from persistence.database import pooled_connect

MAX_ACTIVE_CONVERSATIONS_PER_WORKSPACE = 3
MAX_MESSAGES_PER_CONVERSATION = 20


class AgentConversationNotFoundError(LookupError):
    """Raised when an active conversation is absent from the selected workspace."""


class AgentConversationLimitError(RuntimeError):
    """Raised before persisted conversation state can exceed its bounded contract."""


def _normalized_title(value: str) -> str:
    title = " ".join(value.strip().split())
    if not title:
        raise ValueError("Conversation title is required.")
    if len(title) > 160:
        raise ValueError("Conversation title must contain at most 160 characters.")
    return title


def _summary_content(response: AgentResponseEnvelope) -> str:
    for block in response.blocks:
        if block.type == "text":
            return block.text
    return "CarbonSage returned a structured decision response."


def _validate_citation_records(
    response: AgentResponseEnvelope,
    citations: tuple[CitationRecord, ...],
) -> None:
    response_citations = {
        block.citation_id: block for block in response.blocks if block.type == "citation"
    }
    persisted_citations = {citation.citation_id: citation for citation in citations}
    if len(persisted_citations) != len(citations):
        raise ValueError("Persisted citation ids must be unique.")
    if set(response_citations) != set(persisted_citations):
        raise ValueError("Persisted citations must exactly match response citation blocks.")
    for citation_id, citation in persisted_citations.items():
        if citation.to_block() != response_citations[citation_id]:
            raise ValueError("Persisted citation content must match the response block.")


class AgentRepository(Protocol):
    def create_conversation(
        self,
        *,
        workspace_id: str,
        created_by: str,
        expires_at: datetime,
        title: str,
        now: datetime | None = None,
    ) -> AgentConversation: ...

    def list_conversations(
        self,
        workspace_id: str,
        *,
        now: datetime | None = None,
    ) -> tuple[AgentConversation, ...]: ...

    def get_detail(
        self,
        workspace_id: str,
        conversation_id: str,
        *,
        now: datetime | None = None,
    ) -> ConversationDetail | None: ...

    def append_exchange(
        self,
        *,
        workspace_id: str,
        conversation_id: str,
        user_content: str,
        response: AgentResponseEnvelope,
        citations: tuple[CitationRecord, ...],
        tool_events: tuple[ToolEvent, ...],
        now: datetime | None = None,
    ) -> tuple[AgentMessage, AgentMessage]: ...

    def close_conversation(
        self,
        workspace_id: str,
        conversation_id: str,
        *,
        now: datetime | None = None,
    ) -> AgentConversation: ...

    def purge_expired(self, *, now: datetime | None = None) -> int: ...


class InMemoryAgentRepository:
    """Thread-safe development adapter with the same bounds as PostgreSQL."""

    def __init__(self) -> None:
        self._conversations: dict[tuple[str, str], AgentConversation] = {}
        self._messages: dict[tuple[str, str], list[AgentMessage]] = {}
        self._events: dict[tuple[str, str], list[ToolEvent]] = {}
        self._citations: dict[tuple[str, str], list[CitationRecord]] = {}
        self._lock = threading.RLock()

    @staticmethod
    def _copy_conversation(value: AgentConversation) -> AgentConversation:
        return value.model_copy(deep=True)

    def create_conversation(
        self,
        *,
        workspace_id: str,
        created_by: str,
        expires_at: datetime,
        title: str,
        now: datetime | None = None,
    ) -> AgentConversation:
        timestamp = now or datetime.now(UTC)
        with self._lock:
            active_count = sum(
                1
                for (record_workspace, _), conversation in self._conversations.items()
                if record_workspace == workspace_id
                and conversation.status is ConversationStatus.ACTIVE
                and conversation.expires_at > timestamp
            )
            if active_count >= MAX_ACTIVE_CONVERSATIONS_PER_WORKSPACE:
                raise AgentConversationLimitError("Active conversation limit reached.")
            conversation = AgentConversation(
                workspace_id=workspace_id,
                title=_normalized_title(title),
                created_by=created_by,
                created_at=timestamp,
                updated_at=timestamp,
                expires_at=expires_at,
            )
            key = (workspace_id, conversation.conversation_id)
            self._conversations[key] = conversation
            self._messages[key] = []
            self._events[key] = []
            self._citations[key] = []
            return self._copy_conversation(conversation)

    def list_conversations(
        self,
        workspace_id: str,
        *,
        now: datetime | None = None,
    ) -> tuple[AgentConversation, ...]:
        timestamp = now or datetime.now(UTC)
        with self._lock:
            values = [
                self._copy_conversation(conversation)
                for (record_workspace, _), conversation in self._conversations.items()
                if record_workspace == workspace_id
                and conversation.status is ConversationStatus.ACTIVE
                and conversation.expires_at > timestamp
            ]
        return tuple(sorted(values, key=lambda conversation: conversation.updated_at, reverse=True))

    def get_detail(
        self,
        workspace_id: str,
        conversation_id: str,
        *,
        now: datetime | None = None,
    ) -> ConversationDetail | None:
        timestamp = now or datetime.now(UTC)
        key = (workspace_id, conversation_id)
        with self._lock:
            conversation = self._conversations.get(key)
            if (
                conversation is None
                or conversation.status is not ConversationStatus.ACTIVE
                or conversation.expires_at <= timestamp
            ):
                return None
            return ConversationDetail(
                conversation=self._copy_conversation(conversation),
                messages=[message.model_copy(deep=True) for message in self._messages[key]],
                tool_events=[event.model_copy(deep=True) for event in self._events[key]],
            )

    def append_exchange(
        self,
        *,
        workspace_id: str,
        conversation_id: str,
        user_content: str,
        response: AgentResponseEnvelope,
        citations: tuple[CitationRecord, ...],
        tool_events: tuple[ToolEvent, ...],
        now: datetime | None = None,
    ) -> tuple[AgentMessage, AgentMessage]:
        timestamp = now or datetime.now(UTC)
        _validate_citation_records(response, citations)
        key = (workspace_id, conversation_id)
        with self._lock:
            detail = self.get_detail(workspace_id, conversation_id, now=timestamp)
            if detail is None:
                raise AgentConversationNotFoundError(conversation_id)
            messages = self._messages[key]
            if len(messages) + 2 > MAX_MESSAGES_PER_CONVERSATION:
                raise AgentConversationLimitError("Conversation message limit reached.")
            user_message = AgentMessage(
                conversation_id=conversation_id,
                workspace_id=workspace_id,
                role=MessageRole.USER,
                content=user_content,
                created_at=timestamp,
            )
            assistant_message = AgentMessage(
                conversation_id=conversation_id,
                workspace_id=workspace_id,
                role=MessageRole.ASSISTANT,
                content=_summary_content(response),
                response=response,
                created_at=timestamp,
            )
            messages.extend((user_message, assistant_message))
            self._events[key].extend(event.model_copy(deep=True) for event in tool_events)
            self._citations[key].extend(citation.model_copy(deep=True) for citation in citations)
            self._conversations[key] = detail.conversation.model_copy(
                update={"updated_at": timestamp}
            )
            return user_message.model_copy(deep=True), assistant_message.model_copy(deep=True)

    def close_conversation(
        self,
        workspace_id: str,
        conversation_id: str,
        *,
        now: datetime | None = None,
    ) -> AgentConversation:
        timestamp = now or datetime.now(UTC)
        key = (workspace_id, conversation_id)
        with self._lock:
            conversation = self._conversations.get(key)
            if conversation is None or conversation.expires_at <= timestamp:
                raise AgentConversationNotFoundError(conversation_id)
            closed = conversation.model_copy(
                update={"status": ConversationStatus.CLOSED, "updated_at": timestamp}
            )
            self._conversations[key] = closed
            return self._copy_conversation(closed)

    def purge_expired(self, *, now: datetime | None = None) -> int:
        timestamp = now or datetime.now(UTC)
        with self._lock:
            expired = [
                key
                for key, conversation in self._conversations.items()
                if conversation.expires_at <= timestamp
            ]
            for key in expired:
                del self._conversations[key]
                self._messages.pop(key, None)
                self._events.pop(key, None)
                self._citations.pop(key, None)
            return len(expired)


CONVERSATION_COLUMNS = """
    conversation_id, workspace_id, title, status, policy_version, created_by,
    created_at, updated_at, expires_at
"""

MESSAGE_COLUMNS = """
    message_id, conversation_id, workspace_id, role, content, response, created_at
"""


def _conversation_from_row(row: tuple[Any, ...]) -> AgentConversation:
    return AgentConversation(
        conversation_id=str(row[0]),
        workspace_id=row[1],
        title=row[2],
        status=ConversationStatus(row[3]),
        policy_version=row[4],
        created_by=row[5],
        created_at=row[6],
        updated_at=row[7],
        expires_at=row[8],
    )


def _message_from_row(row: tuple[Any, ...]) -> AgentMessage:
    return AgentMessage(
        message_id=str(row[0]),
        conversation_id=str(row[1]),
        workspace_id=row[2],
        role=MessageRole(row[3]),
        content=row[4],
        response=AgentResponseEnvelope.model_validate(row[5]) if row[5] else None,
        created_at=row[6],
    )


class PostgresAgentRepository:
    """Transactional PostgreSQL adapter with mandatory workspace predicates."""

    def __init__(self, database_url: str) -> None:
        if psycopg is None or Jsonb is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url

    def _connect(self):
        return pooled_connect(self.database_url)

    def create_conversation(
        self,
        *,
        workspace_id: str,
        created_by: str,
        expires_at: datetime,
        title: str,
        now: datetime | None = None,
    ) -> AgentConversation:
        timestamp = now or datetime.now(UTC)
        conversation = AgentConversation(
            workspace_id=workspace_id,
            title=_normalized_title(title),
            created_by=created_by,
            created_at=timestamp,
            updated_at=timestamp,
            expires_at=expires_at,
        )
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT workspace_id FROM workspaces WHERE workspace_id = %s FOR UPDATE",
                    (workspace_id,),
                )
                if cursor.fetchone() is None:
                    connection.rollback()
                    raise AgentConversationNotFoundError(workspace_id)
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM agent_conversations
                    WHERE workspace_id = %s AND status = 'active' AND expires_at > %s
                    """,
                    (workspace_id, timestamp),
                )
                if cursor.fetchone()[0] >= MAX_ACTIVE_CONVERSATIONS_PER_WORKSPACE:
                    connection.rollback()
                    raise AgentConversationLimitError("Active conversation limit reached.")
                cursor.execute(
                    f"""
                    INSERT INTO agent_conversations ({CONVERSATION_COLUMNS})
                    VALUES (%s, %s, %s, 'active', %s, %s, %s, %s, %s)
                    RETURNING {CONVERSATION_COLUMNS}
                    """,
                    (
                        conversation.conversation_id,
                        workspace_id,
                        conversation.title,
                        AGENT_POLICY_VERSION,
                        created_by,
                        timestamp,
                        timestamp,
                        expires_at,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()
        return _conversation_from_row(row)

    def list_conversations(
        self,
        workspace_id: str,
        *,
        now: datetime | None = None,
    ) -> tuple[AgentConversation, ...]:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT {CONVERSATION_COLUMNS}
                    FROM agent_conversations
                    WHERE workspace_id = %s AND status = 'active' AND expires_at > %s
                    ORDER BY updated_at DESC, conversation_id
                    """,
                    (workspace_id, timestamp),
                )
                rows = cursor.fetchall()
        return tuple(_conversation_from_row(row) for row in rows)

    def get_detail(
        self,
        workspace_id: str,
        conversation_id: str,
        *,
        now: datetime | None = None,
    ) -> ConversationDetail | None:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT {CONVERSATION_COLUMNS}
                    FROM agent_conversations
                    WHERE workspace_id = %s AND conversation_id = %s
                      AND status = 'active' AND expires_at > %s
                    """,
                    (workspace_id, conversation_id, timestamp),
                )
                conversation_row = cursor.fetchone()
                if conversation_row is None:
                    return None
                cursor.execute(
                    f"""
                    SELECT {MESSAGE_COLUMNS}
                    FROM agent_messages
                    WHERE workspace_id = %s AND conversation_id = %s
                    ORDER BY sequence_number
                    """,
                    (workspace_id, conversation_id),
                )
                message_rows = cursor.fetchall()
                cursor.execute(
                    """
                    SELECT e.event_id, e.tool_name, e.status, e.duration_ms,
                           e.result_count, e.artifact_ids, e.error_code
                    FROM agent_tool_events AS e
                    JOIN agent_messages AS m ON m.message_id = e.response_message_id
                    WHERE e.workspace_id = %s AND m.conversation_id = %s
                    ORDER BY m.sequence_number, e.sequence_number
                    """,
                    (workspace_id, conversation_id),
                )
                event_rows = cursor.fetchall()
        return ConversationDetail(
            conversation=_conversation_from_row(conversation_row),
            messages=[_message_from_row(row) for row in message_rows],
            tool_events=[
                ToolEvent(
                    event_id=str(row[0]),
                    tool_name=row[1],
                    status=ToolEventStatus(row[2]),
                    duration_ms=row[3],
                    result_count=row[4],
                    artifact_ids=[str(value) for value in row[5]],
                    error_code=row[6],
                )
                for row in event_rows
            ],
        )

    def append_exchange(
        self,
        *,
        workspace_id: str,
        conversation_id: str,
        user_content: str,
        response: AgentResponseEnvelope,
        citations: tuple[CitationRecord, ...],
        tool_events: tuple[ToolEvent, ...],
        now: datetime | None = None,
    ) -> tuple[AgentMessage, AgentMessage]:
        timestamp = now or datetime.now(UTC)
        _validate_citation_records(response, citations)
        user_message = AgentMessage(
            conversation_id=conversation_id,
            workspace_id=workspace_id,
            role=MessageRole.USER,
            content=user_content,
            created_at=timestamp,
        )
        assistant_message = AgentMessage(
            conversation_id=conversation_id,
            workspace_id=workspace_id,
            role=MessageRole.ASSISTANT,
            content=_summary_content(response),
            response=response,
            created_at=timestamp,
        )
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1 FROM agent_conversations
                    WHERE workspace_id = %s AND conversation_id = %s
                      AND status = 'active' AND expires_at > %s
                    FOR UPDATE
                    """,
                    (workspace_id, conversation_id, timestamp),
                )
                if cursor.fetchone() is None:
                    connection.rollback()
                    raise AgentConversationNotFoundError(conversation_id)
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM agent_messages
                    WHERE workspace_id = %s AND conversation_id = %s
                    """,
                    (workspace_id, conversation_id),
                )
                message_count = cursor.fetchone()[0]
                if message_count + 2 > MAX_MESSAGES_PER_CONVERSATION:
                    connection.rollback()
                    raise AgentConversationLimitError("Conversation message limit reached.")
                cursor.execute(
                    f"""
                    INSERT INTO agent_messages ({MESSAGE_COLUMNS}, sequence_number)
                    VALUES (%s, %s, %s, 'user', %s, NULL, %s, %s)
                    RETURNING {MESSAGE_COLUMNS}
                    """,
                    (
                        user_message.message_id,
                        conversation_id,
                        workspace_id,
                        user_message.content,
                        timestamp,
                        message_count + 1,
                    ),
                )
                stored_user = _message_from_row(cursor.fetchone())
                cursor.execute(
                    f"""
                    INSERT INTO agent_messages ({MESSAGE_COLUMNS}, sequence_number)
                    VALUES (%s, %s, %s, 'assistant', %s, %s, %s, %s)
                    RETURNING {MESSAGE_COLUMNS}
                    """,
                    (
                        assistant_message.message_id,
                        conversation_id,
                        workspace_id,
                        assistant_message.content,
                        Jsonb(response.model_dump(mode="json")),
                        timestamp,
                        message_count + 2,
                    ),
                )
                stored_assistant = _message_from_row(cursor.fetchone())
                if citations:
                    cursor.executemany(
                        """
                        INSERT INTO agent_citations
                            (citation_id, response_message_id, workspace_id, artifact_id,
                             filename, document_sha256, page_number, chunk_index, excerpt)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                citation.citation_id,
                                stored_assistant.message_id,
                                workspace_id,
                                citation.artifact_id,
                                citation.filename,
                                citation.document_sha256,
                                citation.page_number,
                                citation.chunk_index,
                                citation.excerpt,
                            )
                            for citation in citations
                        ],
                    )
                if tool_events:
                    cursor.executemany(
                        """
                        INSERT INTO agent_tool_events
                            (event_id, response_message_id, workspace_id, tool_name,
                             status, duration_ms, result_count, artifact_ids, error_code,
                             sequence_number)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                event.event_id,
                                stored_assistant.message_id,
                                workspace_id,
                                event.tool_name,
                                event.status.value,
                                event.duration_ms,
                                event.result_count,
                                event.artifact_ids,
                                event.error_code,
                                sequence_number,
                            )
                            for sequence_number, event in enumerate(tool_events, start=1)
                        ],
                    )
                cursor.execute(
                    """
                    UPDATE agent_conversations SET updated_at = %s
                    WHERE workspace_id = %s AND conversation_id = %s
                    """,
                    (timestamp, workspace_id, conversation_id),
                )
            connection.commit()
        return stored_user, stored_assistant

    def close_conversation(
        self,
        workspace_id: str,
        conversation_id: str,
        *,
        now: datetime | None = None,
    ) -> AgentConversation:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE agent_conversations
                    SET status = 'closed', updated_at = %s
                    WHERE workspace_id = %s AND conversation_id = %s
                      AND status = 'active' AND expires_at > %s
                    RETURNING {CONVERSATION_COLUMNS}
                    """,
                    (timestamp, workspace_id, conversation_id, timestamp),
                )
                row = cursor.fetchone()
                if row is None:
                    connection.rollback()
                    raise AgentConversationNotFoundError(conversation_id)
            connection.commit()
        return _conversation_from_row(row)

    def purge_expired(self, *, now: datetime | None = None) -> int:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM agent_conversations
                    WHERE expires_at <= %s
                    RETURNING conversation_id
                    """,
                    (timestamp,),
                )
                deleted = cursor.rowcount
            connection.commit()
        return deleted


def build_agent_repository(database_url: str | None) -> AgentRepository:
    if database_url:
        return PostgresAgentRepository(database_url)
    return InMemoryAgentRepository()
