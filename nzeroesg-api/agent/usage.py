"""Provider usage extraction without exposing token accounting to the UI."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


@dataclass(frozen=True)
class ModelInvocationUsage:
    cost_usd: Decimal
    estimated: bool
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def has_usage(self) -> bool:
        return self.cost_usd > 0 or self.input_tokens > 0 or self.output_tokens > 0


EMPTY_MODEL_USAGE = ModelInvocationUsage(cost_usd=Decimal("0"), estimated=False)

_MODEL_PRICES_PER_MILLION = {
    "openai/gpt-4.1-mini": (Decimal("0.40"), Decimal("1.60")),
    "gpt-4.1-mini": (Decimal("0.40"), Decimal("1.60")),
}


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _integer(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return 0
    return max(0, int(value))


def _decimal(value: Any) -> Decimal | None:
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return None
    try:
        parsed = Decimal(str(value))
    except InvalidOperation:
        return None
    return parsed if parsed >= 0 else None


def usage_from_ai_message(raw: Any, *, model: str | None) -> ModelInvocationUsage:
    response_metadata = _mapping(getattr(raw, "response_metadata", None))
    usage_metadata = _mapping(getattr(raw, "usage_metadata", None))
    metadata_candidates = (
        response_metadata,
        _mapping(response_metadata.get("token_usage")),
        _mapping(response_metadata.get("usage")),
        usage_metadata,
    )
    input_tokens = next(
        (
            value
            for candidate in metadata_candidates
            if (value := _integer(candidate.get("input_tokens", candidate.get("prompt_tokens"))))
        ),
        0,
    )
    output_tokens = next(
        (
            value
            for candidate in metadata_candidates
            if (
                value := _integer(
                    candidate.get("output_tokens", candidate.get("completion_tokens"))
                )
            )
        ),
        0,
    )
    reported_cost = next(
        (
            cost
            for candidate in metadata_candidates
            if (cost := _decimal(candidate.get("cost"))) is not None
        ),
        None,
    )
    if reported_cost is not None:
        return ModelInvocationUsage(
            cost_usd=reported_cost,
            estimated=False,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    prices = _MODEL_PRICES_PER_MILLION.get(model or "")
    if prices and (input_tokens or output_tokens):
        estimated_cost = (
            Decimal(input_tokens) * prices[0] + Decimal(output_tokens) * prices[1]
        ) / Decimal(1_000_000)
        return ModelInvocationUsage(
            cost_usd=estimated_cost,
            estimated=True,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
    return ModelInvocationUsage(
        cost_usd=Decimal("0"),
        estimated=False,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


__all__ = ["EMPTY_MODEL_USAGE", "ModelInvocationUsage", "usage_from_ai_message"]
