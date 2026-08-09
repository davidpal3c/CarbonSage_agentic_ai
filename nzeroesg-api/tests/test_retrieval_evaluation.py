import json
from pathlib import Path

import pytest

from domain.evidence.evaluation import (
    RetrievalEvaluationCase,
    RetrievalEvaluationResult,
    evaluate_retrieval,
)

CASES_PATH = Path(__file__).parents[1] / "evaluation" / "retrieval_cases.json"
CORPUS_PATH = Path(__file__).parents[1] / "evaluation" / "retrieval_corpus.json"
LEXICAL_REPORT_PATH = Path(__file__).parents[1] / "evaluation" / "reports" / "lexical-baseline.json"


def load_cases() -> tuple[RetrievalEvaluationCase, ...]:
    payload = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    return tuple(
        RetrievalEvaluationCase(
            case_id=item["case_id"],
            category=item["category"],
            query=item["query"],
            expected_ids=tuple(item["expected_ids"]),
            should_answer=item["should_answer"],
        )
        for item in payload
    )


def test_checked_in_retrieval_set_covers_required_question_classes():
    cases = load_cases()
    categories = {case.category for case in cases}

    assert 25 <= len(cases) <= 40
    assert len({case.case_id for case in cases}) == len(cases)
    assert {
        "exact-certification",
        "semantic-paraphrase",
        "structured-context",
        "target-date",
        "evidence-limitation",
        "unsupported",
    } <= categories
    assert any(not case.should_answer for case in cases)


def test_checked_in_cases_reference_a_complete_reproducible_corpus():
    cases = load_cases()
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    corpus_ids = {record["evidence_id"] for record in corpus}
    expected_ids = {identity for case in cases for identity in case.expected_ids}

    assert len(corpus) == 7
    assert len(corpus_ids) == len(corpus)
    assert expected_ids <= corpus_ids
    assert all(record["content"].strip() for record in corpus)


def test_checked_in_lexical_baseline_is_explicitly_retrieval_only():
    report = json.loads(LEXICAL_REPORT_PATH.read_text(encoding="utf-8"))

    assert report["mode"] == "lexical"
    assert report["k"] == 5
    assert report["metrics"]["case_count"] == 25
    assert report["metrics"]["recall_at_k"] == 1.0
    assert report["metrics"]["answer_support_rate"] == 0.0
    assert "retrieval-only" in report["notes"][0]


def test_retrieval_metrics_measure_ranking_citations_support_cost_and_latency():
    cases = load_cases()
    results = tuple(
        RetrievalEvaluationResult(
            case_id=case.case_id,
            retrieved_ids=case.expected_ids,
            cited_ids=case.expected_ids,
            latency_ms=10.0,
            provider_cost_usd=0.000001,
            answer_returned=case.should_answer,
            answer_supported=case.should_answer,
        )
        for case in cases
    )

    metrics = evaluate_retrieval(cases, results, k=5)

    assert metrics.case_count == 25
    assert metrics.recall_at_k == 1.0
    assert metrics.mean_reciprocal_rank == 1.0
    assert metrics.citation_coverage == 1.0
    assert metrics.answer_support_rate == 1.0
    assert metrics.unsupported_answer_rate == 0.0
    assert metrics.mean_latency_ms == 10.0
    assert metrics.provider_cost_usd == pytest.approx(0.000025)


def test_retrieval_metrics_penalize_missing_and_unsupported_answers():
    cases = (
        RetrievalEvaluationCase("answerable", "exact", "question", ("doc",), True),
        RetrievalEvaluationCase("unsupported", "unsupported", "question", (), False),
    )
    results = (
        RetrievalEvaluationResult("answerable", (), (), 5.0),
        RetrievalEvaluationResult(
            "unsupported",
            ("doc",),
            ("doc",),
            5.0,
            answer_returned=True,
            answer_supported=True,
        ),
    )

    metrics = evaluate_retrieval(cases, results)

    assert metrics.answer_support_rate == 0.0
    assert metrics.unsupported_answer_rate == 1.0


def test_retrieval_metrics_reject_inconsistent_supported_answer():
    cases = (RetrievalEvaluationCase("case", "exact", "question", ("doc",), True),)
    results = (
        RetrievalEvaluationResult(
            "case",
            ("doc",),
            ("doc",),
            5.0,
            answer_returned=False,
            answer_supported=True,
        ),
    )

    with pytest.raises(ValueError, match="cannot be supported"):
        evaluate_retrieval(cases, results)
