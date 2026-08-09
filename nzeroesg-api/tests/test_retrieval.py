from dataclasses import replace
from hashlib import sha256

import pytest

from domain.evidence.embeddings import (
    EMBEDDING_DIMENSIONS,
    ChunkEmbedding,
    EmbeddingProviderError,
    EmbeddingSpec,
    chunk_embeddings,
    validate_vector,
)
from domain.evidence.ingestion import extract_evidence
from domain.evidence.models import EvidenceMatch, SupplierMetadata
from domain.evidence.retrieval import RetrievalMode, reciprocal_rank_fusion
from persistence.evidence import InMemoryEvidenceRepository


def unit_vector(index: int) -> tuple[float, ...]:
    values = [0.0] * EMBEDDING_DIMENSIONS
    values[index] = 1.0
    return tuple(values)


def test_embedding_records_validate_dimensions_and_content_identity():
    document = extract_evidence(
        b"Supplier ABC shifts freight from road to lower-emission rail routes.",
        filename="supplier.txt",
        content_type="text/plain",
    ).document

    records = chunk_embeddings(
        chunks=document.chunks,
        vectors=(unit_vector(0),),
        dimensions=EMBEDDING_DIMENSIONS,
    )

    assert records[0].chunk_index == 0
    assert (
        records[0].content_sha256 == sha256(document.chunks[0].content.encode("utf-8")).hexdigest()
    )
    with pytest.raises(EmbeddingProviderError, match="expected 1536"):
        validate_vector((1.0, 0.0), EMBEDDING_DIMENSIONS)


def test_in_memory_semantic_search_is_workspace_and_model_scoped():
    repository = InMemoryEvidenceRepository()
    spec = EmbeddingSpec(provider="fixture", model="semantic-v1")
    first_document = extract_evidence(
        b"Supplier ABC shifts freight from road to lower-emission rail routes.",
        filename="first.txt",
        content_type="text/plain",
    ).document
    second_document = extract_evidence(
        b"Supplier XYZ uses air freight for urgent international deliveries.",
        filename="second.txt",
        content_type="text/plain",
    ).document
    supplier = SupplierMetadata("Supplier ABC", "Canada", (), ("train",))

    repository.store("workspace-a", supplier, first_document)
    repository.store("workspace-b", supplier, second_document)
    pending = repository.list_unembedded_documents("workspace-a", spec)

    assert [document.document_sha256 for document in pending] == [first_document.sha256]
    assert pending[0].chunks[0].content == first_document.chunks[0].content

    repository.store_embeddings(
        "workspace-a",
        first_document.sha256,
        spec,
        (
            ChunkEmbedding(
                chunk_index=0,
                content_sha256=sha256(first_document.chunks[0].content.encode("utf-8")).hexdigest(),
                values=unit_vector(0),
            ),
        ),
    )
    repository.store_embeddings(
        "workspace-b",
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

    matches = repository.search_semantic("workspace-a", unit_vector(0), spec)

    assert repository.list_unembedded_documents("workspace-a", spec) == ()
    assert [match.filename for match in matches] == ["first.txt"]
    assert matches[0].retrieval_mode == RetrievalMode.SEMANTIC
    assert matches[0].semantic_rank == 1
    assert (
        repository.search_semantic(
            "workspace-a",
            unit_vector(0),
            EmbeddingSpec(provider="fixture", model="semantic-v2"),
        )
        == ()
    )


def test_reciprocal_rank_fusion_preserves_citations_and_both_rank_signals():
    first = EvidenceMatch(
        supplier_name="Supplier ABC",
        filename="first.txt",
        excerpt="Rail commitment",
        page_number=2,
        chunk_index=0,
        document_sha256="a" * 64,
    )
    second = replace(
        first,
        filename="second.txt",
        excerpt="ISO certification",
        page_number=3,
        chunk_index=1,
        document_sha256="b" * 64,
    )

    fused = reciprocal_rank_fusion((first, second), (second, first))

    assert [match.document_sha256 for match in fused] == ["a" * 64, "b" * 64]
    assert fused[0].retrieval_mode == RetrievalMode.HYBRID
    assert (fused[0].lexical_rank, fused[0].semantic_rank) == (1, 2)
    assert fused[0].page_number == 2
