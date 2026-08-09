"""Retrieval evaluation records and deterministic metric calculation."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RetrievalEvaluationCase:
    case_id: str
    category: str
    query: str
    expected_ids: tuple[str, ...]
    should_answer: bool


@dataclass(frozen=True)
class RetrievalEvaluationResult:
    case_id: str
    retrieved_ids: tuple[str, ...]
    cited_ids: tuple[str, ...]
    latency_ms: float
    provider_cost_usd: float = 0.0
    answer_returned: bool = False
    answer_supported: bool = False


@dataclass(frozen=True)
class RetrievalMetrics:
    case_count: int
    recall_at_k: float
    mean_reciprocal_rank: float
    citation_coverage: float
    answer_support_rate: float
    unsupported_answer_rate: float
    mean_latency_ms: float
    provider_cost_usd: float

    def to_dict(self) -> dict[str, int | float]:
        return {
            "case_count": self.case_count,
            "recall_at_k": round(self.recall_at_k, 6),
            "mean_reciprocal_rank": round(self.mean_reciprocal_rank, 6),
            "citation_coverage": round(self.citation_coverage, 6),
            "answer_support_rate": round(self.answer_support_rate, 6),
            "unsupported_answer_rate": round(self.unsupported_answer_rate, 6),
            "mean_latency_ms": round(self.mean_latency_ms, 3),
            "provider_cost_usd": round(self.provider_cost_usd, 8),
        }


def evaluate_retrieval(
    cases: tuple[RetrievalEvaluationCase, ...],
    results: tuple[RetrievalEvaluationResult, ...],
    *,
    k: int = 5,
) -> RetrievalMetrics:
    if not cases:
        raise ValueError("At least one retrieval evaluation case is required.")
    if k < 1:
        raise ValueError("k must be at least one.")

    results_by_id = {result.case_id: result for result in results}
    if len(results_by_id) != len(results):
        raise ValueError("Retrieval evaluation result ids must be unique.")
    missing = [case.case_id for case in cases if case.case_id not in results_by_id]
    if missing:
        raise ValueError(f"Missing retrieval results for: {', '.join(missing)}")
    case_ids = {case.case_id for case in cases}
    unexpected = [result.case_id for result in results if result.case_id not in case_ids]
    if unexpected:
        raise ValueError(f"Unexpected retrieval results for: {', '.join(unexpected)}")

    recalls: list[float] = []
    reciprocal_ranks: list[float] = []
    citation_hits = 0
    citation_opportunities = 0
    answer_opportunities = 0
    supported_answers = 0
    unsupported_cases = 0
    unsupported_answers = 0
    latencies: list[float] = []
    provider_cost = 0.0

    for case in cases:
        result = results_by_id[case.case_id]
        top_k = result.retrieved_ids[:k]
        expected = set(case.expected_ids)
        if expected:
            recalls.append(len(expected & set(top_k)) / len(expected))
            first_rank = next(
                (rank for rank, identity in enumerate(top_k, start=1) if identity in expected),
                None,
            )
            reciprocal_ranks.append(0.0 if first_rank is None else 1 / first_rank)
            citation_opportunities += 1
            if expected & set(result.cited_ids):
                citation_hits += 1

        if result.answer_supported and not result.answer_returned:
            raise ValueError(
                f"Result {result.case_id} cannot be supported without returning an answer."
            )
        if case.should_answer:
            answer_opportunities += 1
            if result.answer_returned and result.answer_supported:
                supported_answers += 1
        else:
            unsupported_cases += 1
            if result.answer_returned:
                unsupported_answers += 1

        latencies.append(result.latency_ms)
        provider_cost += result.provider_cost_usd

    return RetrievalMetrics(
        case_count=len(cases),
        recall_at_k=sum(recalls) / len(recalls) if recalls else 1.0,
        mean_reciprocal_rank=(
            sum(reciprocal_ranks) / len(reciprocal_ranks) if reciprocal_ranks else 1.0
        ),
        citation_coverage=(
            citation_hits / citation_opportunities if citation_opportunities else 1.0
        ),
        answer_support_rate=(
            supported_answers / answer_opportunities if answer_opportunities else 1.0
        ),
        unsupported_answer_rate=(
            unsupported_answers / unsupported_cases if unsupported_cases else 0.0
        ),
        mean_latency_ms=sum(latencies) / len(latencies),
        provider_cost_usd=provider_cost,
    )
