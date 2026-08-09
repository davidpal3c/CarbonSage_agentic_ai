"""Typed HTTP boundary for supplier evidence ingestion and retrieval."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from api.workspaces import require_workspace_session, workspace_repository
from config import database_url_for_runtime, settings
from domain.evidence.embeddings import (
    EmbeddingProviderError,
    build_embedding_adapter,
    chunk_embeddings,
)
from domain.evidence.ingestion import (
    MAX_FILE_BYTES,
    EvidenceIngestionError,
    extract_evidence,
    normalize_supplier_metadata,
)
from domain.evidence.models import (
    EvidenceDocument,
    EvidenceMatch,
    SupplierCard,
    SupplierMetadata,
)
from domain.evidence.retrieval import RetrievalMode, reciprocal_rank_fusion
from domain.workspaces.sessions import WorkspaceSession
from persistence.evidence import build_evidence_repository
from persistence.workspaces import QuotaExceededError, WorkspaceNotFoundError

evidence_router = APIRouter(tags=["evidence"])
evidence_repository = build_evidence_repository(database_url_for_runtime())
embedding_adapter = build_embedding_adapter(
    provider=settings.embedding_provider,
    model=settings.embedding_model,
    dimensions=settings.embedding_dimensions,
    openai_api_key=settings.openai_api_key,
    openrouter_api_key=settings.openrouter_api_key,
)
logger = logging.getLogger(__name__)


class SupplierResponse(BaseModel):
    supplier_id: str
    name: str
    region: str | None
    certifications: list[str]
    transport_modes: list[str]
    document_count: int
    missing_fields: list[str]


class CitationResponse(BaseModel):
    page_number: int | None
    chunk_index: int
    document_sha256: str
    filename: str


class RetrievalResponse(BaseModel):
    mode: RetrievalMode
    score: float | None
    lexical_rank: int | None
    semantic_rank: int | None


class EvidenceMatchResponse(BaseModel):
    supplier_name: str
    filename: str
    excerpt: str
    citation: CitationResponse
    retrieval: RetrievalResponse


class EvidenceUploadResponse(BaseModel):
    supplier: SupplierResponse
    filename: str
    media_type: str
    sha256: str
    page_count: int
    extracted_chars: int
    chunk_count: int
    embedding_status: str


class SupplierListResponse(BaseModel):
    suppliers: list[SupplierResponse]


class EvidenceSearchResponse(BaseModel):
    query: str
    requested_mode: RetrievalMode
    mode: RetrievalMode
    semantic_available: bool
    warning: str | None = None
    matches: list[EvidenceMatchResponse]


def _supplier_response(supplier: SupplierCard) -> SupplierResponse:
    return SupplierResponse.model_validate(supplier.to_dict())


def _match_response(match: EvidenceMatch) -> EvidenceMatchResponse:
    return EvidenceMatchResponse.model_validate(match.to_dict())


def _consume_document_quota(workspace_id: str) -> None:
    try:
        workspace_repository.consume_quota(workspace_id, "evidence_documents")
    except WorkspaceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The workspace session is no longer active.",
        ) from exc
    except QuotaExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The evidence document quota for this workspace has been reached.",
        ) from exc


async def _index_document(workspace_id: str, document: EvidenceDocument) -> str:
    if embedding_adapter is None:
        return "not_configured"
    try:
        vectors = await run_in_threadpool(
            embedding_adapter.embed_documents,
            [chunk.content for chunk in document.chunks],
        )
        records = chunk_embeddings(
            chunks=document.chunks,
            vectors=vectors,
            dimensions=embedding_adapter.spec.dimensions,
        )
        await run_in_threadpool(
            evidence_repository.store_embeddings,
            workspace_id,
            document.sha256,
            embedding_adapter.spec,
            records,
        )
    except (EmbeddingProviderError, ValueError):
        logger.exception(
            "Evidence embedding failed",
            extra={"workspace_id": workspace_id, "document_sha256": document.sha256},
        )
        return "failed"
    return "indexed"


async def _index_pending_documents(workspace_id: str) -> None:
    if embedding_adapter is None:
        return
    pending_documents = await run_in_threadpool(
        evidence_repository.list_unembedded_documents,
        workspace_id,
        embedding_adapter.spec,
    )
    for document in pending_documents:
        vectors = await run_in_threadpool(
            embedding_adapter.embed_documents,
            [chunk.content for chunk in document.chunks],
        )
        records = chunk_embeddings(
            chunks=document.chunks,
            vectors=vectors,
            dimensions=embedding_adapter.spec.dimensions,
        )
        await run_in_threadpool(
            evidence_repository.store_embeddings,
            workspace_id,
            document.document_sha256,
            embedding_adapter.spec,
            records,
        )


async def _search_with_mode(
    *,
    workspace_id: str,
    query: str,
    requested_mode: RetrievalMode,
) -> tuple[RetrievalMode, tuple[EvidenceMatch, ...], str | None, bool]:
    lexical = await run_in_threadpool(
        evidence_repository.search_lexical,
        workspace_id,
        query,
    )
    if requested_mode is RetrievalMode.LEXICAL:
        return RetrievalMode.LEXICAL, lexical, None, embedding_adapter is not None

    if embedding_adapter is None:
        if requested_mode is RetrievalMode.SEMANTIC:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Semantic evidence search is not configured in this environment.",
            )
        return (
            RetrievalMode.LEXICAL,
            lexical,
            "Semantic retrieval is unavailable; hybrid search used the lexical baseline.",
            False,
        )

    try:
        await _index_pending_documents(workspace_id)
        query_embedding = await run_in_threadpool(embedding_adapter.embed_query, query)
    except (EmbeddingProviderError, ValueError) as exc:
        if requested_mode is RetrievalMode.SEMANTIC:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Semantic evidence search is temporarily unavailable.",
            ) from exc
        return (
            RetrievalMode.LEXICAL,
            lexical,
            "Semantic retrieval failed; hybrid search used the lexical baseline.",
            False,
        )

    semantic = await run_in_threadpool(
        evidence_repository.search_semantic,
        workspace_id,
        query_embedding,
        embedding_adapter.spec,
    )
    if requested_mode is RetrievalMode.SEMANTIC:
        return RetrievalMode.SEMANTIC, semantic, None, True
    return RetrievalMode.HYBRID, reciprocal_rank_fusion(lexical, semantic), None, True


@evidence_router.post("/evidence/upload", response_model=EvidenceUploadResponse)
async def upload_evidence(
    file: Annotated[UploadFile, File(description="A UTF-8 TXT or text-based PDF")],
    supplier_name: Annotated[str, Form()],
    workspace: Annotated[WorkspaceSession, Depends(require_workspace_session)],
    supplier_region: Annotated[str | None, Form()] = None,
    certifications: Annotated[str | None, Form()] = None,
    transport_modes: Annotated[str | None, Form()] = None,
) -> EvidenceUploadResponse:
    try:
        normalized_supplier = normalize_supplier_metadata(
            name=supplier_name,
            region=supplier_region,
            certifications=certifications,
            transport_modes=transport_modes,
        )
        content = await file.read(MAX_FILE_BYTES + 1)
        extraction = extract_evidence(
            content,
            filename=file.filename or "evidence",
            content_type=file.content_type or "",
        )
    except EvidenceIngestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    supplier = SupplierMetadata(
        name=normalized_supplier[0],
        region=normalized_supplier[1],
        certifications=normalized_supplier[2],
        transport_modes=normalized_supplier[3],
    )
    _consume_document_quota(workspace.workspace_id)
    stored_supplier = evidence_repository.store(
        workspace.workspace_id,
        supplier,
        extraction.document,
    )
    embedding_status = await _index_document(workspace.workspace_id, extraction.document)
    return EvidenceUploadResponse(
        supplier=_supplier_response(stored_supplier),
        filename=extraction.document.filename,
        media_type=extraction.document.media_type,
        sha256=extraction.document.sha256,
        page_count=extraction.document.page_count,
        extracted_chars=extraction.document.extracted_chars,
        chunk_count=len(extraction.document.chunks),
        embedding_status=embedding_status,
    )


@evidence_router.get("/suppliers", response_model=SupplierListResponse)
async def list_suppliers(
    workspace: Annotated[WorkspaceSession, Depends(require_workspace_session)],
) -> SupplierListResponse:
    return SupplierListResponse(
        suppliers=[
            _supplier_response(supplier)
            for supplier in evidence_repository.list_suppliers(workspace.workspace_id)
        ]
    )


@evidence_router.get("/evidence/search", response_model=EvidenceSearchResponse)
async def search_evidence(
    query: Annotated[str, Query(min_length=2, max_length=200)],
    workspace: Annotated[WorkspaceSession, Depends(require_workspace_session)],
    mode: Annotated[RetrievalMode, Query()] = RetrievalMode.LEXICAL,
) -> EvidenceSearchResponse:
    normalized_query = query.strip()
    if len(normalized_query) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Evidence search query must contain at least two characters.",
        )
    mode_used, matches, warning, semantic_available = await _search_with_mode(
        workspace_id=workspace.workspace_id,
        query=normalized_query,
        requested_mode=mode,
    )
    return EvidenceSearchResponse(
        query=normalized_query,
        requested_mode=mode,
        mode=mode_used,
        semantic_available=semantic_available,
        warning=warning,
        matches=[_match_response(match) for match in matches],
    )
