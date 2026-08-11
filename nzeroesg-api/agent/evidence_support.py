"""Constrained evidence-support review over retrieved citation candidates."""

from __future__ import annotations

import json
from typing import Protocol

from agent.llm import load_llm
from agent.policy import load_agent_policy
from domain.agent.models import CitationRecord, EvidenceSupportAssessment


class EvidenceSupportError(RuntimeError):
    """Raised when support cannot be established through a valid typed result."""


class EvidenceSupportAssessor(Protocol):
    async def assess(
        self,
        *,
        question: str,
        candidates: tuple[CitationRecord, ...],
    ) -> EvidenceSupportAssessment: ...


class LlmEvidenceSupportAssessor:
    """Selects only retrieved citation ids that directly support the proposition."""

    def __init__(self) -> None:
        self._assessor = load_llm().with_structured_output(
            EvidenceSupportAssessment,
            include_raw=True,
        )
        self._policy = load_agent_policy()
        self.last_usage: dict[str, int] = {}

    async def assess(
        self,
        *,
        question: str,
        candidates: tuple[CitationRecord, ...],
    ) -> EvidenceSupportAssessment:
        candidate_ids = {candidate.citation_id for candidate in candidates}
        prompt = json.dumps(
            {
                "question": question,
                "citation_candidates": [
                    {
                        "citation_id": candidate.citation_id,
                        "filename": candidate.filename,
                        "page_number": candidate.page_number,
                        "chunk_index": candidate.chunk_index,
                        "excerpt": candidate.excerpt,
                    }
                    for candidate in candidates
                ],
            },
            separators=(",", ":"),
            sort_keys=True,
        )
        try:
            result = await self._assessor.ainvoke(
                (
                    (
                        "system",
                        self._policy
                        + "\n\nEvidence-support task: decide whether retrieved passages "
                        "directly establish the user's requested proposition. Related, "
                        "partial, aspirational, or contradictory text is not support. "
                        "Mere omission is not evidence of absence; an explicit statement "
                        "of absence may support only a matching negative proposition. "
                        "Return `limited` with no citation ids unless at "
                        "least one candidate directly supports the proposition. Never "
                        "write an answer or create a citation id.",
                    ),
                    ("human", prompt),
                )
            )
            if not isinstance(result, dict) or result.get("parsed") is None:
                raise ValueError("The evidence-support response was not parsed.")
            raw = result.get("raw")
            usage = getattr(raw, "usage_metadata", None) or {}
            self.last_usage = {
                key: int(value)
                for key, value in usage.items()
                if key in {"input_tokens", "output_tokens", "total_tokens"}
                and isinstance(value, int | float)
            }
            assessment = EvidenceSupportAssessment.model_validate(result["parsed"])
        except Exception as exc:
            raise EvidenceSupportError(
                "The configured model could not validate evidence support."
            ) from exc
        if not set(assessment.citation_ids) <= candidate_ids:
            raise EvidenceSupportError("Evidence support referenced an unknown citation id.")
        return assessment


__all__ = [
    "EvidenceSupportAssessor",
    "EvidenceSupportError",
    "LlmEvidenceSupportAssessor",
]
