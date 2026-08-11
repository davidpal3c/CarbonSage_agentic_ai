"""Measure cited answer support and safe abstention over the checked-in corpus."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from dataclasses import asdict
from pathlib import Path

from agent.evidence_support import EvidenceSupportError, LlmEvidenceSupportAssessor
from config import settings
from domain.agent.evaluation import grade_evidence_answer
from domain.agent.models import EvidenceSupportAssessment
from domain.agent.tools import AgentToolName, PlannedToolCall
from domain.artifacts.models import ArtifactKind, ArtifactSourceType, create_artifact
from domain.evidence.embeddings import chunk_embeddings
from domain.evidence.evaluation import RetrievalEvaluationResult, evaluate_retrieval
from domain.evidence.ingestion import extract_evidence
from domain.evidence.models import SupplierMetadata
from domain.evidence.retrieval import RetrievalMode
from domain.workspaces.sessions import SessionSigner
from persistence.artifacts import PostgresArtifactRepository
from persistence.evidence import PostgresEvidenceRepository
from persistence.shipments import PostgresShipmentRepository
from persistence.workspaces import build_workspace_repository
from scripts.run_retrieval_evaluation import (
    DEFAULT_CASES,
    DEFAULT_CORPUS,
    _embedding_adapter,
    _load_cases,
    _load_corpus,
    _search,
)
from services.agent_composer import compose_agent_response
from services.agent_tools import AgentToolRegistry


async def capture_agent_answers(
    *,
    database_url: str,
    mode: RetrievalMode,
    input_price_per_million_usd: float,
    output_price_per_million_usd: float,
    cases_path: Path = DEFAULT_CASES,
    corpus_path: Path = DEFAULT_CORPUS,
) -> dict[str, object]:
    if mode is RetrievalMode.SEMANTIC:
        raise ValueError("Agent answer evaluation supports lexical or hybrid retrieval.")
    if input_price_per_million_usd < 0 or output_price_per_million_usd < 0:
        raise ValueError("Provider token prices cannot be negative.")
    cases = _load_cases(cases_path)
    corpus = _load_corpus(corpus_path)
    adapter = _embedding_adapter(mode)
    assessor = LlmEvidenceSupportAssessor()
    workspace_repository = build_workspace_repository(database_url)
    artifact_repository = PostgresArtifactRepository(database_url)
    evidence_repository = PostgresEvidenceRepository(database_url)
    shipment_repository = PostgresShipmentRepository(database_url)
    signer = SessionSigner(
        "carbonsage-agent-answer-evaluation-secret",
        ttl_seconds=3_600,
    )
    workspace, _ = signer.issue()
    workspace_repository.create(workspace)
    evidence_ids_by_artifact: dict[str, str] = {}
    indexing_started = time.perf_counter()

    try:
        for record in corpus:
            document = extract_evidence(
                record.content.encode("utf-8"),
                filename=record.filename,
                content_type="text/plain",
            ).document
            artifact = create_artifact(
                workspace_id=workspace.workspace_id,
                kind=ArtifactKind.EVIDENCE_DOCUMENT,
                title=document.filename,
                source_type=ArtifactSourceType.LOCAL_UPLOAD,
                created_by="agent-answer-evaluation",
                content_sha256=document.sha256,
            )
            artifact_repository.create(artifact)
            evidence_repository.store(
                workspace.workspace_id,
                artifact.artifact_id,
                SupplierMetadata(
                    name=record.supplier_name,
                    region=record.region,
                    certifications=record.certifications,
                    transport_modes=record.transport_modes,
                ),
                document,
            )
            evidence_ids_by_artifact[artifact.artifact_id] = record.evidence_id
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

        async def evidence_search(workspace_id, query, requested_mode):
            matches = _search(
                mode=requested_mode,
                repository=evidence_repository,
                workspace_id=workspace_id,
                query=query,
                adapter=adapter,
            )
            return requested_mode, matches, None, adapter is not None

        tools = AgentToolRegistry(
            artifact_repository=artifact_repository,
            evidence_repository=evidence_repository,
            shipment_repository=shipment_repository,
            evidence_search=evidence_search,
        )
        results: list[RetrievalEvaluationResult] = []
        response_records: list[dict[str, object]] = []
        assessment_failures = 0
        total_input_tokens = 0
        total_output_tokens = 0

        for case in cases:
            started = time.perf_counter()
            execution = await tools.execute(
                workspace.workspace_id,
                PlannedToolCall(
                    call_id=f"answer-{case.case_id}",
                    tool_name=AgentToolName.SEARCH_SUPPLIER_EVIDENCE,
                    arguments={
                        "query": case.query,
                        "mode": mode.value,
                        "limit": 5,
                    },
                ),
            )
            assessment = EvidenceSupportAssessment(status="limited")
            if execution.citations:
                try:
                    assessment = await assessor.assess(
                        question=case.query,
                        candidates=execution.citations,
                    )
                except EvidenceSupportError:
                    assessment_failures += 1
            input_tokens = assessor.last_usage.get("input_tokens", 0)
            output_tokens = assessor.last_usage.get("output_tokens", 0)
            assessor.last_usage = {}
            total_input_tokens += input_tokens
            total_output_tokens += output_tokens
            case_cost = (
                input_tokens * input_price_per_million_usd
                + output_tokens * output_price_per_million_usd
            ) / 1_000_000
            latency_ms = (time.perf_counter() - started) * 1_000
            response, _ = compose_agent_response(
                (execution,),
                processing_time_ms=round(latency_ms),
                evidence_support=assessment,
            )
            grade = grade_evidence_answer(
                response,
                expected_ids=case.expected_ids,
                evidence_ids_by_artifact=evidence_ids_by_artifact,
            )
            retrieved_ids = tuple(
                dict.fromkeys(
                    evidence_ids_by_artifact[citation.artifact_id]
                    for citation in execution.citations
                )
            )
            result = RetrievalEvaluationResult(
                case_id=case.case_id,
                retrieved_ids=retrieved_ids,
                cited_ids=grade.cited_ids,
                latency_ms=latency_ms,
                provider_cost_usd=case_cost,
                answer_returned=grade.answer_returned,
                answer_supported=grade.answer_supported,
            )
            results.append(result)
            response_records.append(
                {
                    **asdict(result),
                    "expected_ids": list(case.expected_ids),
                    "should_answer": case.should_answer,
                    "evidence_status": response.evidence_status.value,
                    "warning_codes": [
                        block.code for block in response.blocks if block.type == "warning"
                    ],
                }
            )

        metrics = evaluate_retrieval(cases, tuple(results), k=5)
        estimated_provider_cost_usd = (
            total_input_tokens * input_price_per_million_usd
            + total_output_tokens * output_price_per_million_usd
        ) / 1_000_000
        return {
            "metadata": {
                "evaluation": "typed-agent-answer-support",
                "mode": mode.value,
                "provider": settings.llm_provider,
                "model": (
                    settings.openai_model
                    if settings.llm_provider == "openai"
                    else settings.openrouter_model
                ),
                "embedding_provider": adapter.spec.provider if adapter else None,
                "embedding_model": adapter.spec.model if adapter else None,
                "corpus_size": len(corpus),
                "case_count": len(cases),
                "indexing_latency_ms": round(indexing_latency_ms, 3),
                "assessment_failures": assessment_failures,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "input_price_per_million_usd": input_price_per_million_usd,
                "output_price_per_million_usd": output_price_per_million_usd,
                "estimated_provider_cost_usd": round(
                    estimated_provider_cost_usd,
                    8,
                ),
                "tool_selection": "fixed search_supplier_evidence",
            },
            "metrics": metrics.to_dict(),
            "results": response_records,
        }
    finally:
        workspace_repository.revoke(workspace.workspace_id)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", ""))
    parser.add_argument(
        "--mode",
        choices=(RetrievalMode.LEXICAL.value, RetrievalMode.HYBRID.value),
        default=RetrievalMode.LEXICAL.value,
    )
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--input-price-per-million-usd", type=float, required=True)
    parser.add_argument("--output-price-per-million-usd", type=float, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.database_url:
        parser.error("--database-url or DATABASE_URL is required")

    captured = asyncio.run(
        capture_agent_answers(
            database_url=args.database_url,
            mode=RetrievalMode(args.mode),
            input_price_per_million_usd=args.input_price_per_million_usd,
            output_price_per_million_usd=args.output_price_per_million_usd,
            cases_path=args.cases,
            corpus_path=args.corpus,
        )
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(captured, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
