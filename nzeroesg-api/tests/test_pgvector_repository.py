import os
import time
from hashlib import sha256

import pytest

from domain.evidence.embeddings import (
    EMBEDDING_DIMENSIONS,
    ChunkEmbedding,
    EmbeddingSpec,
)
from domain.evidence.ingestion import extract_evidence
from domain.evidence.models import SupplierMetadata
from domain.evidence.retrieval import RetrievalMode
from domain.workspaces.sessions import SessionSigner
from persistence.evidence import PostgresEvidenceRepository
from persistence.workspaces import build_workspace_repository
from scripts.run_retrieval_evaluation import (
    DEFAULT_CASES,
    DEFAULT_CORPUS,
    _load_cases,
    _load_corpus,
    capture_results,
)

DATABASE_URL = os.getenv("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="PostgreSQL integration test")


def unit_vector(index: int) -> tuple[float, ...]:
    values = [0.0] * EMBEDDING_DIMENSIONS
    values[index] = 1.0
    return tuple(values)


def test_pgvector_storage_query_and_workspace_isolation():
    workspace_repository = build_workspace_repository(DATABASE_URL)
    evidence_repository = PostgresEvidenceRepository(DATABASE_URL or "")
    signer = SessionSigner("test-secret-that-is-at-least-32-characters", ttl_seconds=3_600)
    first_workspace, _ = signer.issue(now=int(time.time()))
    second_workspace, _ = signer.issue(now=int(time.time()))
    workspace_repository.create(first_workspace)
    workspace_repository.create(second_workspace)
    spec = EmbeddingSpec(provider="fixture", model="semantic-v1")
    supplier = SupplierMetadata("Supplier ABC", "Canada", (), ("train",))
    first_document = extract_evidence(
        b"Supplier ABC shifts freight from road to lower-emission rail routes.",
        filename="first.txt",
        content_type="text/plain",
    ).document
    second_document = extract_evidence(
        b"Supplier XYZ uses urgent air freight.",
        filename="second.txt",
        content_type="text/plain",
    ).document

    try:
        evidence_repository.store(first_workspace.workspace_id, supplier, first_document)
        evidence_repository.store(second_workspace.workspace_id, supplier, second_document)
        pending = evidence_repository.list_unembedded_documents(
            first_workspace.workspace_id,
            spec,
        )

        assert [document.document_sha256 for document in pending] == [first_document.sha256]

        evidence_repository.store_embeddings(
            first_workspace.workspace_id,
            first_document.sha256,
            spec,
            (
                ChunkEmbedding(
                    chunk_index=0,
                    content_sha256=sha256(
                        first_document.chunks[0].content.encode("utf-8")
                    ).hexdigest(),
                    values=unit_vector(0),
                ),
            ),
        )
        evidence_repository.store_embeddings(
            second_workspace.workspace_id,
            second_document.sha256,
            spec,
            (
                ChunkEmbedding(
                    chunk_index=0,
                    content_sha256=sha256(
                        second_document.chunks[0].content.encode("utf-8")
                    ).hexdigest(),
                    values=unit_vector(0),
                ),
            ),
        )

        matches = evidence_repository.search_semantic(
            first_workspace.workspace_id,
            unit_vector(0),
            spec,
        )
        lexical_matches = evidence_repository.search_lexical(
            first_workspace.workspace_id,
            "Which supplier moves road freight to lower emission rail routes?",
        )

        assert (
            evidence_repository.list_unembedded_documents(
                first_workspace.workspace_id,
                spec,
            )
            == ()
        )
        assert [match.filename for match in matches] == ["first.txt"]
        assert [match.filename for match in lexical_matches] == ["first.txt"]
        assert matches[0].semantic_rank == 1
        assert matches[0].score == pytest.approx(1.0)
        assert (
            evidence_repository.search_semantic(
                first_workspace.workspace_id,
                unit_vector(0),
                EmbeddingSpec(provider="fixture", model="semantic-v2"),
            )
            == ()
        )
    finally:
        workspace_repository.revoke(first_workspace.workspace_id)
        workspace_repository.revoke(second_workspace.workspace_id)


def test_lexical_evaluation_capture_uses_checked_in_corpus():
    captured = capture_results(
        database_url=DATABASE_URL or "",
        mode=RetrievalMode.LEXICAL,
        cases=_load_cases(DEFAULT_CASES),
        corpus=_load_corpus(DEFAULT_CORPUS),
        provider_cost_usd=0.0,
    )

    assert captured["metadata"]["mode"] == "lexical"
    assert captured["metadata"]["corpus_size"] == 7
    assert len(captured["results"]) == 25
    assert any(result["retrieved_ids"] for result in captured["results"])
