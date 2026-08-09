"""Grade captured retrieval results against the checked-in CarbonSage cases."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from domain.evidence.evaluation import (
    RetrievalEvaluationCase,
    RetrievalEvaluationResult,
    evaluate_retrieval,
)

DEFAULT_CASES = Path(__file__).parents[1] / "evaluation" / "retrieval_cases.json"


def _load_cases(path: Path) -> tuple[RetrievalEvaluationCase, ...]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return tuple(
        RetrievalEvaluationCase(
            case_id=item["case_id"],
            category=item["category"],
            query=item["query"],
            expected_ids=tuple(item["expected_ids"]),
            should_answer=bool(item["should_answer"]),
        )
        for item in payload
    )


def _load_results(path: Path) -> tuple[RetrievalEvaluationResult, ...]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payload = payload["results"]
    return tuple(
        RetrievalEvaluationResult(
            case_id=item["case_id"],
            retrieved_ids=tuple(item["retrieved_ids"]),
            cited_ids=tuple(item.get("cited_ids", [])),
            latency_ms=float(item["latency_ms"]),
            provider_cost_usd=float(item.get("provider_cost_usd", 0.0)),
            answer_returned=bool(item.get("answer_returned", False)),
            answer_supported=bool(item.get("answer_supported", False)),
        )
        for item in payload
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("results", type=Path)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()

    metrics = evaluate_retrieval(
        _load_cases(args.cases),
        _load_results(args.results),
        k=args.k,
    )
    print(json.dumps(metrics.to_dict(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
