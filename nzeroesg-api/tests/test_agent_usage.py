from decimal import Decimal
from types import SimpleNamespace

from agent.usage import ModelInvocationUsage, usage_from_ai_message
from persistence.agent_usage import InMemoryAgentUsageRepository


def test_openrouter_reported_cost_is_preferred_over_local_estimate():
    raw = SimpleNamespace(
        response_metadata={
            "usage": {
                "prompt_tokens": 1_000,
                "completion_tokens": 500,
                "cost": 0.00123,
            }
        },
        usage_metadata={},
    )

    usage = usage_from_ai_message(raw, model="openai/gpt-4.1-mini")

    assert usage.cost_usd == Decimal("0.00123")
    assert usage.estimated is False
    assert usage.input_tokens == 1_000
    assert usage.output_tokens == 500


def test_known_model_cost_is_estimated_when_provider_cost_is_absent():
    raw = SimpleNamespace(
        response_metadata={},
        usage_metadata={"input_tokens": 1_000, "output_tokens": 500},
    )

    usage = usage_from_ai_message(raw, model="openai/gpt-4.1-mini")

    assert usage.cost_usd == Decimal("0.0012")
    assert usage.estimated is True


def test_daily_usage_keeps_provider_and_estimated_spend_distinct():
    repository = InMemoryAgentUsageRepository()
    repository.record(
        "workspace-1",
        ModelInvocationUsage(cost_usd=Decimal("0.002"), estimated=False),
    )
    repository.record(
        "workspace-1",
        ModelInvocationUsage(cost_usd=Decimal("0.001"), estimated=True),
    )

    usage = repository.get_today("workspace-1")

    assert usage.model_calls == 2
    assert usage.provider_cost_usd == Decimal("0.002")
    assert usage.estimated_cost_usd == Decimal("0.001")
    assert usage.total_cost_usd == Decimal("0.003")
    assert usage.cost_is_estimate is True
