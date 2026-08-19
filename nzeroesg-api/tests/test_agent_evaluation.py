import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from domain.agent.evaluation import grade_evidence_answer
from domain.agent.models import (
    AgentResponseEnvelope,
    CitationRecord,
    EvidenceStatus,
    WarningBlock,
)

BASELINE_PATH = (
    Path(__file__).parents[1]
    / "evaluation"
    / "reports"
    / "agent-answer-hybrid-openrouter-baseline.json"
)


def citation(artifact_id: str, suffix: str) -> CitationRecord:
    return CitationRecord(
        artifact_id=artifact_id,
        filename=f"{suffix}.txt",
        document_sha256=suffix * 64,
        chunk_index=0,
        excerpt="Synthetic evidence excerpt.",
    )


def test_answer_support_requires_exact_expected_citation_coverage():
    expected = citation("artifact-expected", "a")
    response = AgentResponseEnvelope(
        evidence_status=EvidenceStatus.SUPPORTED,
        blocks=[expected.to_block()],
        processing_time_ms=1,
    )

    grade = grade_evidence_answer(
        response,
        expected_ids=("expected",),
        evidence_ids_by_artifact={"artifact-expected": "expected"},
    )

    assert grade.answer_returned is True
    assert grade.answer_supported is True
    assert grade.cited_ids == ("expected",)


def test_answer_support_rejects_an_extra_unexpected_citation():
    expected = citation("artifact-expected", "a")
    unrelated = citation("artifact-unrelated", "b")
    response = AgentResponseEnvelope(
        evidence_status=EvidenceStatus.SUPPORTED,
        blocks=[expected.to_block(), unrelated.to_block()],
        processing_time_ms=1,
    )

    grade = grade_evidence_answer(
        response,
        expected_ids=("expected",),
        evidence_ids_by_artifact={
            "artifact-expected": "expected",
            "artifact-unrelated": "unrelated",
        },
    )

    assert grade.answer_returned is True
    assert grade.answer_supported is False


def test_evidence_limitation_is_a_safe_abstention():
    response = AgentResponseEnvelope(
        evidence_status=EvidenceStatus.LIMITED,
        blocks=[WarningBlock(code="evidence_limit", message="Evidence is insufficient.")],
        processing_time_ms=1,
    )

    grade = grade_evidence_answer(
        response,
        expected_ids=(),
        evidence_ids_by_artifact={},
    )

    assert grade.answer_returned is False
    assert grade.answer_supported is False
    assert grade.cited_ids == ()


def test_response_envelope_cannot_claim_support_without_a_citation():
    with pytest.raises(ValidationError, match="require at least one citation"):
        AgentResponseEnvelope(
            evidence_status=EvidenceStatus.SUPPORTED,
            blocks=[WarningBlock(code="invalid", message="No citation is present.")],
            processing_time_ms=1,
        )


def test_checked_in_provider_baseline_records_support_and_safe_abstention():
    report = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    metadata = report["metadata"]
    metrics = report["metrics"]
    results = report["results"]

    assert metadata["evaluation"] == "typed-agent-answer-support"
    assert metadata["provider"] == "openrouter"
    assert metadata["mode"] == "hybrid"
    assert metadata["corpus_size"] == 7
    assert metadata["case_count"] == 25
    assert metadata["assessment_failures"] == 0
    assert metadata["embedding_cost_included"] is False
    assert metadata["tool_selection"] == "fixed search_supplier_evidence"
    assert metrics["answer_support_rate"] == 1.0
    assert metrics["unsupported_answer_rate"] == 0.0
    assert len(results) == 25
    assert all(result["answer_supported"] for result in results if result["should_answer"])
    assert all(not result["answer_returned"] for result in results if not result["should_answer"])
