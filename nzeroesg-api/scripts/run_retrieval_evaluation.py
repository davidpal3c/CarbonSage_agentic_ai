"""Capture lexical, semantic, or hybrid retrieval results in PostgreSQL."""

from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from config import settings
from domain.evidence.embeddings import EmbeddingAdapter, build_embedding_adapter, chunk_embeddings
from domain.evidence.evaluation import RetrievalEvaluationCase, RetrievalEvaluationResult
from domain.evidence.ingestion import extract_evidence
from domain.evidence.models import EvidenceMatch, SupplierMetadata
from domain.evidence.retrieval import RetrievalMode, reciprocal_rank_fusion
from domain.workspaces.sessions import SessionSigner
from persistence.evidence import PostgresEvidenceRepository
from persistence.workspaces import build_workspace_repository

DEFAULT_CASES = Path(__file__).parents[1] / "evaluation" / "retrieval_cases.json"
DEFAULT_CORPUS = Path(__file__).parents[1] / "evaluation" / "retrieval_corpus.json"


@dataclass(frozen=True)
class CorpusRecord:
    evidence_id: str
    supplier_name: str
    region: str | None
    certifications: tuple[str, ...]
    transport_modes: tuple[str, ...]
    filename: str
    content: str


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


def _load_corpus(path: Path) -> tuple[CorpusRecord, ...]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return tuple(
        CorpusRecord(
            evidence_id=item["evidence_id"],
            supplier_name=item["supplier_name"],
            region=item.get("region"),
            certifications=tuple(item.get("certifications", [])),
            transport_modes=tuple(item.get("transport_modes", [])),
            filename=item["filename"],
            content=item["content"],
        )
        for item in payload
    )


def _embedding_adapter(mode: RetrievalMode) -> EmbeddingAdapter | None:
    if mode is RetrievalMode.LEXICAL:
        return None
    adapter = build_embedding_adapter(
        provider=settings.embedding_provider,
        model=settings.embedding_model,
        dimensions=settings.embedding_dimensions,
        openai_api_key=settings.openai_api_key,
        openrouter_api_key=settings.openrouter_api_key,
    )
    if adapter is None:
        raise RuntimeError(
            "EMBEDDING_PROVIDER, EMBEDDING_MODEL, and its API key are required "
            "for semantic or hybrid evaluation."
        )
    return adapter


def _ranked_evidence_ids(
    matches: tuple[EvidenceMatch, ...],
    evidence_ids_by_sha: dict[str, str],
) -> tuple[str, ...]:
    ranked: list[str] = []
    for match in matches:
        evidence_id = evidence_ids_by_sha[match.document_sha256]
        if evidence_id not in ranked:
            ranked.append(evidence_id)
    return tuple(ranked)


def _search(
    *,
    mode: RetrievalMode,
    repository: PostgresEvidenceRepository,
    workspace_id: str,
    query: str,
    adapter: EmbeddingAdapter | None,
) -> tuple[EvidenceMatch, ...]:
    lexical = repository.search_lexical(workspace_id, query)
    if mode is RetrievalMode.LEXICAL:
        return lexical
    if adapter is None:
        raise RuntimeError("An embedding adapter is required for this evaluation mode.")
    semantic = repository.search_semantic(
        workspace_id,
        adapter.embed_query(query),
        adapter.spec,
    )
    if mode is RetrievalMode.SEMANTIC:
        return semantic
    return reciprocal_rank_fusion(lexical, semantic)


def capture_results(
    *,
    database_url: str,
    mode: RetrievalMode,
    cases: tuple[RetrievalEvaluationCase, ...],
    corpus: tuple[CorpusRecord, ...],
    provider_cost_usd: float,
) -> dict[str, object]:
    if provider_cost_usd < 0:
        raise ValueError("Provider cost cannot be negative.")
    if not cases or not corpus:
        raise ValueError("Evaluation cases and corpus records are required.")
    corpus_ids = {record.evidence_id for record in corpus}
    if len(corpus_ids) != len(corpus):
        raise ValueError("Evaluation corpus ids must be unique.")
    expected_ids = {identity for case in cases for identity in case.expected_ids}
    if not expected_ids <= corpus_ids:
        missing = ", ".join(sorted(expected_ids - corpus_ids))
        raise ValueError(f"Evaluation cases reference missing corpus ids: {missing}")

    adapter = _embedding_adapter(mode)
    workspace_repository = build_workspace_repository(database_url)
    evidence_repository = PostgresEvidenceRepository(database_url)
    signer = SessionSigner(
        "carbonsage-retrieval-evaluation-only-secret",
        ttl_seconds=3_600,
    )
    workspace, _ = signer.issue()
    workspace_repository.create(workspace)
    evidence_ids_by_sha: dict[str, str] = {}
    indexing_started = time.perf_counter()

    try:
        for record in corpus:
            document = extract_evidence(
                record.content.encode("utf-8"),
                filename=record.filename,
                content_type="text/plain",
            ).document
            evidence_repository.store(
                workspace.workspace_id,
                SupplierMetadata(
                    name=record.supplier_name,
                    region=record.region,
                    certifications=record.certifications,
                    transport_modes=record.transport_modes,
                ),
                document,
            )
            evidence_ids_by_sha[document.sha256] = record.evidence_id
            if adapter is not None:
                vectors = adapter.embed_documents([chunk.content for chunk in document.chunks])
                evidence_repository.store_embeddings(
                    workspace.workspace_id,
                    document.sha256,
                    adapter.spec,
                    chunk_embeddings(
                        chunks=document.chunks,
                        vectors=vectors,
                        dimensions=adapter.spec.dimensions,
                    ),
                )

        indexing_latency_ms = (time.perf_counter() - indexing_started) * 1_000
        per_case_cost = provider_cost_usd / len(cases) if cases else 0.0
        results: list[RetrievalEvaluationResult] = []
        for case in cases:
            started = time.perf_counter()
            matches = _search(
                mode=mode,
                repository=evidence_repository,
                workspace_id=workspace.workspace_id,
                query=case.query,
                adapter=adapter,
            )
            latency_ms = (time.perf_counter() - started) * 1_000
            retrieved_ids = _ranked_evidence_ids(matches, evidence_ids_by_sha)
            results.append(
                RetrievalEvaluationResult(
                    case_id=case.case_id,
                    retrieved_ids=retrieved_ids,
                    cited_ids=retrieved_ids,
                    latency_ms=latency_ms,
                    provider_cost_usd=per_case_cost,
                )
            )

        return {
            "metadata": {
                "mode": mode.value,
                "provider": adapter.spec.provider if adapter else None,
                "model": adapter.spec.model if adapter else None,
                "dimensions": adapter.spec.dimensions if adapter else None,
                "corpus_size": len(corpus),
                "case_count": len(cases),
                "indexing_latency_ms": round(indexing_latency_ms, 3),
                "provider_cost_usd": provider_cost_usd,
            },
            "results": [asdict(result) for result in results],
        }
    finally:
        workspace_repository.revoke(workspace.workspace_id)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", ""))
    parser.add_argument("--mode", choices=tuple(RetrievalMode), required=True)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--provider-cost-usd", type=float, default=0.0)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.database_url:
        parser.error("--database-url or DATABASE_URL is required")

    captured = capture_results(
        database_url=args.database_url,
        mode=RetrievalMode(args.mode),
        cases=_load_cases(args.cases),
        corpus=_load_corpus(args.corpus),
        provider_cost_usd=args.provider_cost_usd,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(captured, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
