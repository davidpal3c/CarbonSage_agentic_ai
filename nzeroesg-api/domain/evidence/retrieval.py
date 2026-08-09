"""Deterministic retrieval ranking and lexical/vector fusion."""

from __future__ import annotations

from dataclasses import replace
from enum import StrEnum

from domain.evidence.models import EvidenceMatch

RRF_K = 60


class RetrievalMode(StrEnum):
    LEXICAL = "lexical"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"


def rank_matches(
    matches: tuple[EvidenceMatch, ...],
    *,
    mode: RetrievalMode,
) -> tuple[EvidenceMatch, ...]:
    ranked: list[EvidenceMatch] = []
    for rank, match in enumerate(matches, start=1):
        ranked.append(
            replace(
                match,
                retrieval_mode=mode.value,
                lexical_rank=rank if mode is RetrievalMode.LEXICAL else None,
                semantic_rank=rank if mode is RetrievalMode.SEMANTIC else None,
            )
        )
    return tuple(ranked)


def reciprocal_rank_fusion(
    lexical: tuple[EvidenceMatch, ...],
    semantic: tuple[EvidenceMatch, ...],
    *,
    limit: int = 20,
) -> tuple[EvidenceMatch, ...]:
    candidates: dict[tuple[str, int], EvidenceMatch] = {}
    scores: dict[tuple[str, int], float] = {}
    lexical_ranks: dict[tuple[str, int], int] = {}
    semantic_ranks: dict[tuple[str, int], int] = {}

    for rank, match in enumerate(lexical, start=1):
        identity = match.identity
        candidates.setdefault(identity, match)
        scores[identity] = scores.get(identity, 0.0) + 1 / (RRF_K + rank)
        lexical_ranks[identity] = rank

    for rank, match in enumerate(semantic, start=1):
        identity = match.identity
        candidates.setdefault(identity, match)
        scores[identity] = scores.get(identity, 0.0) + 1 / (RRF_K + rank)
        semantic_ranks[identity] = rank

    ordered = sorted(
        candidates,
        key=lambda identity: (
            -scores[identity],
            identity[0],
            identity[1],
        ),
    )[:limit]
    return tuple(
        replace(
            candidates[identity],
            retrieval_mode=RetrievalMode.HYBRID.value,
            score=scores[identity],
            lexical_rank=lexical_ranks.get(identity),
            semantic_rank=semantic_ranks.get(identity),
        )
        for identity in ordered
    )
