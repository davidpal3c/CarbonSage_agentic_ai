"""Deterministic grading for evidence-grounded agent responses."""

from __future__ import annotations

from dataclasses import dataclass

from domain.agent.models import AgentResponseEnvelope, EvidenceStatus


@dataclass(frozen=True)
class AgentAnswerGrade:
    answer_returned: bool
    answer_supported: bool
    cited_ids: tuple[str, ...]


def grade_evidence_answer(
    response: AgentResponseEnvelope,
    *,
    expected_ids: tuple[str, ...],
    evidence_ids_by_artifact: dict[str, str],
) -> AgentAnswerGrade:
    """Require approved citations to cover exactly the expected synthetic evidence."""

    cited_ids = tuple(
        dict.fromkeys(
            evidence_ids_by_artifact[block.artifact_id]
            for block in response.blocks
            if block.type == "citation" and block.artifact_id in evidence_ids_by_artifact
        )
    )
    answer_returned = response.evidence_status is EvidenceStatus.SUPPORTED
    expected = set(expected_ids)
    cited = set(cited_ids)
    answer_supported = bool(
        answer_returned and expected and expected <= cited and cited <= expected
    )
    return AgentAnswerGrade(
        answer_returned=answer_returned,
        answer_supported=answer_supported,
        cited_ids=cited_ids,
    )
