"""Bounded text and PDF extraction with recoverable chunk locations."""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass

from domain.emissions.modes import normalize_mode
from domain.evidence.models import EvidenceChunk, EvidenceDocument

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TEXT_CHARS = 500_000
MAX_CHUNKS = 1_000
CHUNK_SIZE = 1_000
CHUNK_OVERLAP = 100
ALLOWED_CONTENT_TYPES = {"text/plain", "application/pdf"}


class EvidenceIngestionError(ValueError):
    """Raised when an evidence upload is unsupported or unsafe to extract."""


@dataclass(frozen=True)
class EvidenceExtraction:
    document: EvidenceDocument


def _clean_text(value: str) -> str:
    return re.sub(r"[ \t]+", " ", value.replace("\r\n", "\n").replace("\r", "\n")).strip()


def _chunks_for_page(
    text: str,
    *,
    page_number: int | None,
    start_index: int,
) -> list[EvidenceChunk]:
    cleaned = _clean_text(text)
    if not cleaned:
        return []
    chunks: list[EvidenceChunk] = []
    start = 0
    chunk_index = start_index
    while start < len(cleaned):
        end = min(start + CHUNK_SIZE, len(cleaned))
        if end < len(cleaned):
            boundary = cleaned.rfind(" ", start + CHUNK_SIZE // 2, end)
            if boundary > start:
                end = boundary
        content = cleaned[start:end].strip()
        if content:
            chunks.append(
                EvidenceChunk(
                    chunk_index=chunk_index,
                    content=content,
                    page_number=page_number,
                    section=None,
                )
            )
            chunk_index += 1
        if end >= len(cleaned):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def _normalize_list(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(dict.fromkeys(item.strip() for item in value.split(",") if item.strip()))


def normalize_supplier_metadata(
    *,
    name: str,
    region: str | None,
    certifications: str | None,
    transport_modes: str | None,
) -> tuple[str, str | None, tuple[str, ...], tuple[str, ...]]:
    normalized_name = name.strip()
    if not normalized_name or len(normalized_name) > 160:
        raise EvidenceIngestionError(
            "Supplier name is required and must be 160 characters or fewer."
        )
    normalized_region = region.strip() if region and region.strip() else None
    if normalized_region and len(normalized_region) > 120:
        raise EvidenceIngestionError("Supplier region must be 120 characters or fewer.")
    normalized_certifications = _normalize_list(certifications)
    if len(normalized_certifications) > 12:
        raise EvidenceIngestionError("A supplier may have at most 12 certifications.")
    normalized_modes: list[str] = []
    for mode in _normalize_list(transport_modes):
        try:
            normalized_modes.append(normalize_mode(mode).value)
        except ValueError as exc:
            raise EvidenceIngestionError(f"Unsupported supplier transport mode: {mode}.") from exc
    return (
        normalized_name,
        normalized_region,
        normalized_certifications,
        tuple(dict.fromkeys(normalized_modes)),
    )


def extract_evidence(
    content: bytes,
    *,
    filename: str,
    content_type: str,
) -> EvidenceExtraction:
    """Extract bounded text from a TXT or text-based PDF upload."""
    if not filename.strip() or len(filename) > 255:
        raise EvidenceIngestionError(
            "Evidence file name is required and must be 255 characters or fewer."
        )
    if len(content) > MAX_FILE_BYTES:
        raise EvidenceIngestionError("Evidence file exceeds the 10 MB limit.")
    normalized_type = content_type.split(";", 1)[0].strip().lower()
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    expected_types = {"txt": "text/plain", "pdf": "application/pdf"}
    if suffix not in expected_types or normalized_type != expected_types[suffix]:
        raise EvidenceIngestionError("Only UTF-8 TXT and text-based PDF files are supported.")
    if b"\x00" in content:
        raise EvidenceIngestionError("NUL characters are not allowed in evidence content.")

    pages: list[tuple[int | None, str]] = []
    if normalized_type == "text/plain":
        try:
            pages.append((None, content.decode("utf-8-sig")))
        except UnicodeDecodeError as exc:
            raise EvidenceIngestionError("TXT evidence must be valid UTF-8 text.") from exc
    else:
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content), strict=False)
            if reader.is_encrypted:
                raise EvidenceIngestionError("Encrypted PDFs are not supported.")
            pages.extend(
                (page_number, page.extract_text() or "")
                for page_number, page in enumerate(reader.pages, 1)
            )
        except EvidenceIngestionError:
            raise
        except Exception as exc:
            raise EvidenceIngestionError("PDF text could not be extracted safely.") from exc

    if sum(len(text) for _, text in pages) > MAX_TEXT_CHARS:
        raise EvidenceIngestionError("Extracted evidence text exceeds the 500,000 character limit.")
    chunks: list[EvidenceChunk] = []
    for page_number, text in pages:
        chunks.extend(_chunks_for_page(text, page_number=page_number, start_index=len(chunks)))
    if not chunks:
        raise EvidenceIngestionError("No text could be extracted from the evidence file.")
    if len(chunks) > MAX_CHUNKS:
        raise EvidenceIngestionError("Evidence contains too many text chunks for the demo limit.")
    return EvidenceExtraction(
        document=EvidenceDocument(
            filename=filename,
            media_type=normalized_type,
            sha256=hashlib.sha256(content).hexdigest(),
            page_count=len(pages),
            extracted_chars=sum(len(chunk.content) for chunk in chunks),
            chunks=tuple(chunks),
        )
    )
