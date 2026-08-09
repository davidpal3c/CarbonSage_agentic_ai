"""Workspace-scoped supplier and evidence persistence with cited search."""

from __future__ import annotations

from contextlib import closing
from hashlib import sha256
from math import sqrt
from typing import Protocol
from uuid import uuid4

try:
    import psycopg
except ImportError:  # pragma: no cover - exercised only before optional local setup
    psycopg = None

from domain.evidence.embeddings import (
    ChunkEmbedding,
    EmbeddingSpec,
    PendingEmbeddingDocument,
    validate_vector,
)
from domain.evidence.models import (
    EvidenceChunk,
    EvidenceDocument,
    EvidenceMatch,
    SupplierCard,
    SupplierMetadata,
)
from domain.evidence.retrieval import RetrievalMode, rank_matches


class EvidenceRepository(Protocol):
    def store(
        self,
        workspace_id: str,
        supplier: SupplierMetadata,
        document: EvidenceDocument,
    ) -> SupplierCard: ...

    def list_suppliers(self, workspace_id: str) -> tuple[SupplierCard, ...]: ...

    def store_embeddings(
        self,
        workspace_id: str,
        document_sha256: str,
        spec: EmbeddingSpec,
        embeddings: tuple[ChunkEmbedding, ...],
    ) -> int: ...

    def list_unembedded_documents(
        self,
        workspace_id: str,
        spec: EmbeddingSpec,
    ) -> tuple[PendingEmbeddingDocument, ...]: ...

    def search_lexical(self, workspace_id: str, query: str) -> tuple[EvidenceMatch, ...]: ...

    def search_semantic(
        self,
        workspace_id: str,
        query_embedding: tuple[float, ...],
        spec: EmbeddingSpec,
    ) -> tuple[EvidenceMatch, ...]: ...


def _vector_literal(values: tuple[float, ...]) -> str:
    return "[" + ",".join(format(value, ".12g") for value in values) + "]"


def _cosine_similarity(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def _missing_fields(
    *,
    region: str | None,
    certifications: tuple[str, ...],
    transport_modes: tuple[str, ...],
) -> tuple[str, ...]:
    missing: list[str] = []
    if not region:
        missing.append("region")
    if not certifications:
        missing.append("certifications")
    if not transport_modes:
        missing.append("transport_modes")
    return tuple(missing)


def _card(
    *,
    supplier_id: str,
    supplier: SupplierMetadata,
    document_count: int,
) -> SupplierCard:
    return SupplierCard(
        supplier_id=supplier_id,
        name=supplier.name,
        region=supplier.region,
        certifications=supplier.certifications,
        transport_modes=supplier.transport_modes,
        document_count=document_count,
        missing_fields=_missing_fields(
            region=supplier.region,
            certifications=supplier.certifications,
            transport_modes=supplier.transport_modes,
        ),
    )


class InMemoryEvidenceRepository:
    """Development-only workspace-keyed evidence adapter."""

    def __init__(self) -> None:
        self._suppliers: dict[tuple[str, str], tuple[str, SupplierMetadata, int]] = {}
        self._documents: dict[tuple[str, str], tuple[str, SupplierMetadata, EvidenceDocument]] = {}
        self._embeddings: dict[tuple[str, str, int, str, str], ChunkEmbedding] = {}

    def store(
        self,
        workspace_id: str,
        supplier: SupplierMetadata,
        document: EvidenceDocument,
    ) -> SupplierCard:
        supplier_key = (workspace_id, supplier.name.casefold())
        supplier_id, _, document_count = self._suppliers.get(
            supplier_key,
            (str(uuid4()), supplier, 0),
        )
        document_key = (workspace_id, document.sha256)
        if document_key not in self._documents:
            self._documents[document_key] = (supplier_id, supplier, document)
            document_count += 1
        self._suppliers[supplier_key] = (supplier_id, supplier, document_count)
        return _card(supplier_id=supplier_id, supplier=supplier, document_count=document_count)

    def list_suppliers(self, workspace_id: str) -> tuple[SupplierCard, ...]:
        cards = [
            _card(supplier_id=supplier_id, supplier=supplier, document_count=document_count)
            for (record_workspace, _), (
                supplier_id,
                supplier,
                document_count,
            ) in self._suppliers.items()
            if record_workspace == workspace_id
        ]
        return tuple(sorted(cards, key=lambda card: card.name.casefold()))

    def store_embeddings(
        self,
        workspace_id: str,
        document_sha256: str,
        spec: EmbeddingSpec,
        embeddings: tuple[ChunkEmbedding, ...],
    ) -> int:
        document_record = self._documents.get((workspace_id, document_sha256))
        if document_record is None:
            raise ValueError("Evidence document was not found in this workspace.")
        document = document_record[2]
        chunks_by_index = {chunk.chunk_index: chunk for chunk in document.chunks}
        for embedding in embeddings:
            chunk = chunks_by_index.get(embedding.chunk_index)
            if chunk is None:
                raise ValueError("Embedding references an unknown evidence chunk.")
            content_hash = sha256(chunk.content.encode("utf-8")).hexdigest()
            if content_hash != embedding.content_sha256:
                raise ValueError("Embedding content hash does not match the evidence chunk.")
            validate_vector(embedding.values, spec.dimensions)
            self._embeddings[
                (
                    workspace_id,
                    document_sha256,
                    embedding.chunk_index,
                    spec.provider,
                    spec.model,
                )
            ] = embedding
        return len(embeddings)

    def list_unembedded_documents(
        self,
        workspace_id: str,
        spec: EmbeddingSpec,
    ) -> tuple[PendingEmbeddingDocument, ...]:
        pending: list[PendingEmbeddingDocument] = []
        for (record_workspace, document_sha), (
            _supplier_id,
            _supplier,
            document,
        ) in self._documents.items():
            if record_workspace != workspace_id:
                continue
            missing_chunks = tuple(
                chunk
                for chunk in document.chunks
                if (
                    workspace_id,
                    document_sha,
                    chunk.chunk_index,
                    spec.provider,
                    spec.model,
                )
                not in self._embeddings
            )
            if missing_chunks:
                pending.append(
                    PendingEmbeddingDocument(
                        document_sha256=document_sha,
                        chunks=missing_chunks,
                    )
                )
        return tuple(sorted(pending, key=lambda document: document.document_sha256))

    def search_lexical(self, workspace_id: str, query: str) -> tuple[EvidenceMatch, ...]:
        terms = {term.casefold() for term in query.split() if term.strip()}
        matches: list[tuple[int, EvidenceMatch]] = []
        for (record_workspace, _), (_supplier_id, supplier, document) in self._documents.items():
            if record_workspace != workspace_id:
                continue
            for chunk in document.chunks:
                content_terms = set(chunk.content.casefold().split())
                score = len(terms & content_terms)
                if score:
                    matches.append(
                        (
                            score,
                            EvidenceMatch(
                                supplier_name=supplier.name,
                                filename=document.filename,
                                excerpt=chunk.content,
                                page_number=chunk.page_number,
                                chunk_index=chunk.chunk_index,
                                document_sha256=document.sha256,
                                score=float(score),
                            ),
                        )
                    )
        ordered = tuple(
            match
            for _, match in sorted(
                matches,
                key=lambda item: (-item[0], item[1].document_sha256, item[1].chunk_index),
            )[:20]
        )
        return rank_matches(ordered, mode=RetrievalMode.LEXICAL)

    def search_semantic(
        self,
        workspace_id: str,
        query_embedding: tuple[float, ...],
        spec: EmbeddingSpec,
    ) -> tuple[EvidenceMatch, ...]:
        validated_query = validate_vector(query_embedding, spec.dimensions)
        matches: list[EvidenceMatch] = []
        for (record_workspace, document_sha), (
            _supplier_id,
            supplier,
            document,
        ) in self._documents.items():
            if record_workspace != workspace_id:
                continue
            for chunk in document.chunks:
                embedding = self._embeddings.get(
                    (
                        workspace_id,
                        document_sha,
                        chunk.chunk_index,
                        spec.provider,
                        spec.model,
                    )
                )
                if embedding is None:
                    continue
                matches.append(
                    EvidenceMatch(
                        supplier_name=supplier.name,
                        filename=document.filename,
                        excerpt=chunk.content,
                        page_number=chunk.page_number,
                        chunk_index=chunk.chunk_index,
                        document_sha256=document.sha256,
                        retrieval_mode=RetrievalMode.SEMANTIC.value,
                        score=_cosine_similarity(embedding.values, validated_query),
                    )
                )
        ordered = tuple(
            sorted(
                matches,
                key=lambda match: (
                    -(match.score or 0.0),
                    match.document_sha256,
                    match.chunk_index,
                ),
            )[:20]
        )
        return rank_matches(ordered, mode=RetrievalMode.SEMANTIC)

    def search(self, workspace_id: str, query: str) -> tuple[EvidenceMatch, ...]:
        """Compatibility alias for the lexical baseline."""

        return self.search_lexical(workspace_id, query)


class PostgresEvidenceRepository:
    """PostgreSQL lexical and pgvector evidence repository."""

    def __init__(self, database_url: str) -> None:
        if psycopg is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url

    def _connect(self):
        return psycopg.connect(self.database_url)

    def store(
        self,
        workspace_id: str,
        supplier: SupplierMetadata,
        document: EvidenceDocument,
    ) -> SupplierCard:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO suppliers
                        (supplier_id, workspace_id, name, region, certifications, transport_modes)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (workspace_id, name)
                    DO UPDATE SET region = EXCLUDED.region,
                                  certifications = EXCLUDED.certifications,
                                  transport_modes = EXCLUDED.transport_modes,
                                  updated_at = CURRENT_TIMESTAMP
                    RETURNING supplier_id
                    """,
                    (
                        str(uuid4()),
                        workspace_id,
                        supplier.name,
                        supplier.region,
                        list(supplier.certifications),
                        list(supplier.transport_modes),
                    ),
                )
                supplier_id = str(cursor.fetchone()[0])
                cursor.execute(
                    """
                    SELECT document_id FROM evidence_documents
                    WHERE workspace_id = %s AND sha256 = %s
                    """,
                    (workspace_id, document.sha256),
                )
                existing = cursor.fetchone()
                if existing is None:
                    document_id = str(uuid4())
                    cursor.execute(
                        """
                        INSERT INTO evidence_documents
                            (document_id, workspace_id, supplier_id, filename, media_type,
                             sha256, page_count, extracted_chars)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            document_id,
                            workspace_id,
                            supplier_id,
                            document.filename,
                            document.media_type,
                            document.sha256,
                            document.page_count,
                            document.extracted_chars,
                        ),
                    )
                    cursor.executemany(
                        """
                        INSERT INTO evidence_chunks
                            (chunk_id, workspace_id, document_id, supplier_id,
                             chunk_index, page_number, section, content)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                str(uuid4()),
                                workspace_id,
                                document_id,
                                supplier_id,
                                chunk.chunk_index,
                                chunk.page_number,
                                chunk.section,
                                chunk.content,
                            )
                            for chunk in document.chunks
                        ],
                    )
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM evidence_documents
                    WHERE workspace_id = %s AND supplier_id = %s
                    """,
                    (workspace_id, supplier_id),
                )
                document_count = cursor.fetchone()[0]
            connection.commit()
        return _card(supplier_id=supplier_id, supplier=supplier, document_count=document_count)

    def list_suppliers(self, workspace_id: str) -> tuple[SupplierCard, ...]:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT s.supplier_id, s.name, s.region, s.certifications,
                           s.transport_modes, COUNT(d.document_id)
                    FROM suppliers AS s
                    LEFT JOIN evidence_documents AS d
                        ON d.supplier_id = s.supplier_id
                       AND d.workspace_id = s.workspace_id
                    WHERE s.workspace_id = %s
                    GROUP BY s.supplier_id, s.name, s.region, s.certifications, s.transport_modes
                    ORDER BY s.name
                    """,
                    (workspace_id,),
                )
                rows = cursor.fetchall()
        return tuple(
            _card(
                supplier_id=str(row[0]),
                supplier=SupplierMetadata(
                    name=row[1],
                    region=row[2],
                    certifications=tuple(row[3] or ()),
                    transport_modes=tuple(row[4] or ()),
                ),
                document_count=row[5],
            )
            for row in rows
        )

    def store_embeddings(
        self,
        workspace_id: str,
        document_sha256: str,
        spec: EmbeddingSpec,
        embeddings: tuple[ChunkEmbedding, ...],
    ) -> int:
        if not embeddings:
            return 0
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT c.chunk_id, c.chunk_index, c.content
                    FROM evidence_chunks AS c
                    JOIN evidence_documents AS d
                        ON d.document_id = c.document_id
                       AND d.workspace_id = c.workspace_id
                    WHERE c.workspace_id = %s AND d.sha256 = %s
                    ORDER BY c.chunk_index
                    """,
                    (workspace_id, document_sha256),
                )
                chunks = {row[1]: (str(row[0]), row[2]) for row in cursor.fetchall()}
                if not chunks:
                    raise ValueError("Evidence document was not found in this workspace.")

                records: list[tuple[object, ...]] = []
                for embedding in embeddings:
                    chunk = chunks.get(embedding.chunk_index)
                    if chunk is None:
                        raise ValueError("Embedding references an unknown evidence chunk.")
                    chunk_id, content = chunk
                    content_hash = sha256(content.encode("utf-8")).hexdigest()
                    if content_hash != embedding.content_sha256:
                        raise ValueError(
                            "Embedding content hash does not match the evidence chunk."
                        )
                    vector = validate_vector(embedding.values, spec.dimensions)
                    records.append(
                        (
                            str(uuid4()),
                            workspace_id,
                            chunk_id,
                            spec.provider,
                            spec.model,
                            spec.dimensions,
                            embedding.content_sha256,
                            _vector_literal(vector),
                        )
                    )
                cursor.executemany(
                    """
                    INSERT INTO evidence_chunk_embeddings
                        (embedding_id, workspace_id, chunk_id, provider, model,
                         dimensions, content_sha256, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                    ON CONFLICT (chunk_id, provider, model)
                    DO UPDATE SET dimensions = EXCLUDED.dimensions,
                                  content_sha256 = EXCLUDED.content_sha256,
                                  embedding = EXCLUDED.embedding,
                                  updated_at = CURRENT_TIMESTAMP
                    """,
                    records,
                )
            connection.commit()
        return len(records)

    def list_unembedded_documents(
        self,
        workspace_id: str,
        spec: EmbeddingSpec,
    ) -> tuple[PendingEmbeddingDocument, ...]:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.sha256, c.chunk_index, c.content, c.page_number, c.section
                    FROM evidence_documents AS d
                    JOIN evidence_chunks AS c
                        ON c.document_id = d.document_id
                       AND c.workspace_id = d.workspace_id
                    LEFT JOIN evidence_chunk_embeddings AS e
                        ON e.chunk_id = c.chunk_id
                       AND e.workspace_id = c.workspace_id
                       AND e.provider = %s
                       AND e.model = %s
                    WHERE d.workspace_id = %s
                      AND e.chunk_id IS NULL
                    ORDER BY d.sha256, c.chunk_index
                    """,
                    (spec.provider, spec.model, workspace_id),
                )
                rows = cursor.fetchall()

        grouped: dict[str, list[EvidenceChunk]] = {}
        for row in rows:
            grouped.setdefault(row[0], []).append(
                EvidenceChunk(
                    chunk_index=row[1],
                    content=row[2],
                    page_number=row[3],
                    section=row[4],
                )
            )
        return tuple(
            PendingEmbeddingDocument(
                document_sha256=document_sha,
                chunks=tuple(chunks),
            )
            for document_sha, chunks in grouped.items()
        )

    def search_lexical(self, workspace_id: str, query: str) -> tuple[EvidenceMatch, ...]:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    WITH lexical_query AS (
                        SELECT replace(
                            plainto_tsquery('english', %s)::text,
                            ' & ',
                            ' | '
                        )::tsquery AS value
                    )
                    SELECT s.name, d.filename, c.content, c.page_number,
                           c.chunk_index, d.sha256,
                           ts_rank(c.search_vector, lexical_query.value) AS rank
                    FROM evidence_chunks AS c
                    JOIN evidence_documents AS d
                        ON d.document_id = c.document_id
                       AND d.workspace_id = c.workspace_id
                    JOIN suppliers AS s
                        ON s.supplier_id = c.supplier_id
                       AND s.workspace_id = c.workspace_id
                    CROSS JOIN lexical_query
                    WHERE c.workspace_id = %s
                      AND c.search_vector @@ lexical_query.value
                    ORDER BY rank DESC, d.sha256, c.chunk_index
                    LIMIT 20
                    """,
                    (query, workspace_id),
                )
                rows = cursor.fetchall()
        matches = tuple(
            EvidenceMatch(
                supplier_name=row[0],
                filename=row[1],
                excerpt=row[2],
                page_number=row[3],
                chunk_index=row[4],
                document_sha256=row[5],
                score=float(row[6]),
            )
            for row in rows
        )
        return rank_matches(matches, mode=RetrievalMode.LEXICAL)

    def search_semantic(
        self,
        workspace_id: str,
        query_embedding: tuple[float, ...],
        spec: EmbeddingSpec,
    ) -> tuple[EvidenceMatch, ...]:
        vector = _vector_literal(validate_vector(query_embedding, spec.dimensions))
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT s.name, d.filename, c.content, c.page_number,
                           c.chunk_index, d.sha256,
                           1 - (e.embedding <=> %s::vector) AS similarity
                    FROM evidence_chunk_embeddings AS e
                    JOIN evidence_chunks AS c
                        ON c.chunk_id = e.chunk_id
                       AND c.workspace_id = e.workspace_id
                    JOIN evidence_documents AS d
                        ON d.document_id = c.document_id
                       AND d.workspace_id = c.workspace_id
                    JOIN suppliers AS s
                        ON s.supplier_id = c.supplier_id
                       AND s.workspace_id = c.workspace_id
                    WHERE e.workspace_id = %s
                      AND e.provider = %s
                      AND e.model = %s
                      AND e.dimensions = %s
                    ORDER BY e.embedding <=> %s::vector, d.sha256, c.chunk_index
                    LIMIT 20
                    """,
                    (
                        vector,
                        workspace_id,
                        spec.provider,
                        spec.model,
                        spec.dimensions,
                        vector,
                    ),
                )
                rows = cursor.fetchall()
        matches = tuple(
            EvidenceMatch(
                supplier_name=row[0],
                filename=row[1],
                excerpt=row[2],
                page_number=row[3],
                chunk_index=row[4],
                document_sha256=row[5],
                retrieval_mode=RetrievalMode.SEMANTIC.value,
                score=float(row[6]),
            )
            for row in rows
        )
        return rank_matches(matches, mode=RetrievalMode.SEMANTIC)

    def search(self, workspace_id: str, query: str) -> tuple[EvidenceMatch, ...]:
        """Compatibility alias for the lexical baseline."""

        return self.search_lexical(workspace_id, query)


def build_evidence_repository(database_url: str | None) -> EvidenceRepository:
    if database_url:
        return PostgresEvidenceRepository(database_url)
    return InMemoryEvidenceRepository()
