"""Supplier evidence extraction and citation domain types."""

from domain.evidence.embeddings import (
    EMBEDDING_DIMENSIONS,
    ChunkEmbedding,
    EmbeddingAdapter,
    EmbeddingProviderError,
    EmbeddingSpec,
    PendingEmbeddingDocument,
)
from domain.evidence.ingestion import EvidenceExtraction, EvidenceIngestionError, extract_evidence
from domain.evidence.models import (
    EvidenceChunk,
    EvidenceDocument,
    EvidenceMatch,
    SupplierCard,
    SupplierMetadata,
)

__all__ = [
    "EvidenceChunk",
    "EvidenceDocument",
    "EvidenceExtraction",
    "EvidenceIngestionError",
    "EvidenceMatch",
    "EMBEDDING_DIMENSIONS",
    "ChunkEmbedding",
    "EmbeddingAdapter",
    "EmbeddingProviderError",
    "EmbeddingSpec",
    "PendingEmbeddingDocument",
    "SupplierCard",
    "SupplierMetadata",
    "extract_evidence",
]
