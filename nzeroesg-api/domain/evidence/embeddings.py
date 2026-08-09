"""Provider-neutral embedding contracts for bounded evidence chunks."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from typing import Protocol

from domain.evidence.models import EvidenceChunk

EMBEDDING_DIMENSIONS = 1_536


class EmbeddingProviderError(RuntimeError):
    """Raised when configured embedding generation is unavailable or invalid."""


@dataclass(frozen=True)
class EmbeddingSpec:
    provider: str
    model: str
    dimensions: int = EMBEDDING_DIMENSIONS

    def __post_init__(self) -> None:
        if not self.provider.strip() or not self.model.strip():
            raise ValueError("Embedding provider and model are required.")
        if self.dimensions != EMBEDDING_DIMENSIONS:
            raise ValueError(
                f"CarbonSage embeddings must contain {EMBEDDING_DIMENSIONS} dimensions."
            )


@dataclass(frozen=True)
class ChunkEmbedding:
    chunk_index: int
    content_sha256: str
    values: tuple[float, ...]


@dataclass(frozen=True)
class PendingEmbeddingDocument:
    document_sha256: str
    chunks: tuple[EvidenceChunk, ...]


class EmbeddingAdapter(Protocol):
    @property
    def spec(self) -> EmbeddingSpec: ...

    def embed_documents(self, texts: Sequence[str]) -> tuple[tuple[float, ...], ...]: ...

    def embed_query(self, text: str) -> tuple[float, ...]: ...


def validate_vector(values: Sequence[float], dimensions: int) -> tuple[float, ...]:
    vector = tuple(float(value) for value in values)
    if len(vector) != dimensions:
        raise EmbeddingProviderError(
            f"Embedding provider returned {len(vector)} dimensions; expected {dimensions}."
        )
    if not all(isfinite(value) for value in vector):
        raise EmbeddingProviderError("Embedding provider returned a non-finite value.")
    return vector


def chunk_embeddings(
    *,
    chunks: Sequence[EvidenceChunk],
    vectors: Sequence[Sequence[float]],
    dimensions: int,
) -> tuple[ChunkEmbedding, ...]:
    if len(chunks) != len(vectors):
        raise EmbeddingProviderError("Embedding count does not match the evidence chunk count.")

    records: list[ChunkEmbedding] = []
    for chunk, values in zip(chunks, vectors, strict=True):
        content = chunk.content
        records.append(
            ChunkEmbedding(
                chunk_index=chunk.chunk_index,
                content_sha256=sha256(content.encode("utf-8")).hexdigest(),
                values=validate_vector(values, dimensions),
            )
        )
    return tuple(records)


class OpenAICompatibleEmbeddingAdapter:
    """Thin adapter around an OpenAI-compatible embeddings endpoint."""

    def __init__(
        self,
        *,
        provider: str,
        api_key: str,
        model: str,
        dimensions: int = EMBEDDING_DIMENSIONS,
        base_url: str | None = None,
    ) -> None:
        if not api_key:
            raise EmbeddingProviderError(f"An API key is required for {provider} embeddings.")

        from langchain_openai import OpenAIEmbeddings

        self._spec = EmbeddingSpec(
            provider=provider,
            model=model,
            dimensions=dimensions,
        )
        self._client = OpenAIEmbeddings(
            api_key=api_key,
            base_url=base_url,
            dimensions=dimensions,
            model=model,
            max_retries=2,
            timeout=20,
        )

    @property
    def spec(self) -> EmbeddingSpec:
        return self._spec

    def embed_documents(self, texts: Sequence[str]) -> tuple[tuple[float, ...], ...]:
        if not texts:
            return ()
        try:
            vectors = self._client.embed_documents(list(texts))
        except Exception as exc:
            raise EmbeddingProviderError("The embedding provider request failed.") from exc
        return tuple(validate_vector(vector, self.spec.dimensions) for vector in vectors)

    def embed_query(self, text: str) -> tuple[float, ...]:
        try:
            vector = self._client.embed_query(text)
        except Exception as exc:
            raise EmbeddingProviderError("The embedding provider request failed.") from exc
        return validate_vector(vector, self.spec.dimensions)


def build_embedding_adapter(
    *,
    provider: str,
    model: str | None,
    dimensions: int,
    openai_api_key: str | None,
    openrouter_api_key: str | None,
) -> EmbeddingAdapter | None:
    normalized_provider = provider.strip().lower()
    if not normalized_provider:
        return None
    if not model:
        raise EmbeddingProviderError("EMBEDDING_MODEL is required when embeddings are enabled.")

    if normalized_provider == "openai":
        return OpenAICompatibleEmbeddingAdapter(
            provider="openai",
            api_key=openai_api_key or "",
            model=model,
            dimensions=dimensions,
        )
    if normalized_provider == "openrouter":
        return OpenAICompatibleEmbeddingAdapter(
            provider="openrouter",
            api_key=openrouter_api_key or "",
            model=model,
            dimensions=dimensions,
            base_url="https://openrouter.ai/api/v1",
        )
    raise EmbeddingProviderError("EMBEDDING_PROVIDER must be 'openai' or 'openrouter'.")
