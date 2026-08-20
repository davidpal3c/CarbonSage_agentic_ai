"""Daily workspace-scoped assistant cost accounting."""

from __future__ import annotations

from contextlib import closing
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Protocol

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

from agent.usage import ModelInvocationUsage


@dataclass(frozen=True)
class AgentDailyUsage:
    usage_date: date
    model_calls: int
    provider_cost_usd: Decimal
    estimated_cost_usd: Decimal

    @property
    def total_cost_usd(self) -> Decimal:
        return self.provider_cost_usd + self.estimated_cost_usd

    @property
    def cost_is_estimate(self) -> bool:
        return self.estimated_cost_usd > 0


class AgentUsageRepository(Protocol):
    def record(self, workspace_id: str, usage: ModelInvocationUsage) -> None: ...

    def get_today(self, workspace_id: str) -> AgentDailyUsage: ...


def _today() -> date:
    return datetime.now(UTC).date()


def _empty() -> AgentDailyUsage:
    return AgentDailyUsage(
        usage_date=_today(),
        model_calls=0,
        provider_cost_usd=Decimal("0"),
        estimated_cost_usd=Decimal("0"),
    )


class InMemoryAgentUsageRepository:
    def __init__(self) -> None:
        self._records: dict[tuple[str, date], AgentDailyUsage] = {}

    def record(self, workspace_id: str, usage: ModelInvocationUsage) -> None:
        if not usage.has_usage:
            return
        key = (workspace_id, _today())
        current = self._records.get(key, _empty())
        self._records[key] = AgentDailyUsage(
            usage_date=key[1],
            model_calls=current.model_calls + 1,
            provider_cost_usd=current.provider_cost_usd
            + (Decimal("0") if usage.estimated else usage.cost_usd),
            estimated_cost_usd=current.estimated_cost_usd
            + (usage.cost_usd if usage.estimated else Decimal("0")),
        )

    def get_today(self, workspace_id: str) -> AgentDailyUsage:
        return self._records.get((workspace_id, _today()), _empty())


class PostgresAgentUsageRepository:
    def __init__(self, database_url: str) -> None:
        if psycopg is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url

    def _connect(self):
        return psycopg.connect(self.database_url)

    def record(self, workspace_id: str, usage: ModelInvocationUsage) -> None:
        if not usage.has_usage:
            return
        usage_date = _today()
        provider_cost = Decimal("0") if usage.estimated else usage.cost_usd
        estimated_cost = usage.cost_usd if usage.estimated else Decimal("0")
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO agent_daily_usage
                        (workspace_id, usage_date, model_calls,
                         provider_cost_usd, estimated_cost_usd)
                    VALUES (%s, %s, 1, %s, %s)
                    ON CONFLICT (workspace_id, usage_date) DO UPDATE
                    SET model_calls = agent_daily_usage.model_calls + 1,
                        provider_cost_usd = agent_daily_usage.provider_cost_usd
                            + EXCLUDED.provider_cost_usd,
                        estimated_cost_usd = agent_daily_usage.estimated_cost_usd
                            + EXCLUDED.estimated_cost_usd,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (workspace_id, usage_date, provider_cost, estimated_cost),
                )
            connection.commit()

    def get_today(self, workspace_id: str) -> AgentDailyUsage:
        usage_date = _today()
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT usage_date, model_calls, provider_cost_usd, estimated_cost_usd
                    FROM agent_daily_usage
                    WHERE workspace_id = %s AND usage_date = %s
                    """,
                    (workspace_id, usage_date),
                )
                row = cursor.fetchone()
        if row is None:
            return _empty()
        return AgentDailyUsage(
            usage_date=row[0],
            model_calls=row[1],
            provider_cost_usd=Decimal(row[2]),
            estimated_cost_usd=Decimal(row[3]),
        )


def build_agent_usage_repository(database_url: str | None) -> AgentUsageRepository:
    if database_url:
        return PostgresAgentUsageRepository(database_url)
    return InMemoryAgentUsageRepository()


__all__ = ["AgentDailyUsage", "AgentUsageRepository", "build_agent_usage_repository"]
