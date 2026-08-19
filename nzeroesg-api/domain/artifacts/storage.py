"""Provider-neutral artifact source-retention contracts and cost policy."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum


class ArtifactObjectStatus(StrEnum):
    RESERVED = "reserved"
    READY = "ready"
    DELETE_PENDING = "delete_pending"
    DELETED = "deleted"
    FAILED = "failed"


class ArtifactStorageError(RuntimeError):
    """Base error for retained artifact source operations."""


class ArtifactStorageNotFoundError(ArtifactStorageError, LookupError):
    """Raised when retained source bytes are unavailable to the workspace."""


class ArtifactStorageBudgetExceededError(ArtifactStorageError):
    """Raised before an operation that would cross a configured cost guardrail."""

    def __init__(self, dimension: str) -> None:
        self.dimension = dimension
        super().__init__(f"Artifact storage {dimension} budget has been reached.")


class ArtifactStorageProviderError(ArtifactStorageError):
    """Raised when the configured object-store provider cannot complete an operation."""


@dataclass(frozen=True)
class ArtifactStoragePolicy:
    """Hard application limits priced for AWS S3 Standard in Canada Central.

    The estimate intentionally ignores promotional credits and the recurring
    account-wide AWS data-transfer allowance. This leaves room below the
    approved USD 0.50 S3 service ceiling for pricing drift and incidental
    operations. Taxes, currency conversion, and unrelated AWS services are
    outside this service-specific envelope.
    """

    max_active_storage_bytes: int = 4_000_000_000
    max_workspace_storage_bytes: int = 55_000_000
    max_write_requests_per_month: int = 10_000
    max_read_requests_per_month: int = 100_000
    max_egress_bytes_per_month: int = 2_000_000_000
    retention_hours: int = 24
    billing_ceiling_usd: Decimal = Decimal("0.50")
    storage_usd_per_gb_month: Decimal = Decimal("0.025")
    writes_usd_per_1000: Decimal = Decimal("0.0055")
    reads_usd_per_10000: Decimal = Decimal("0.0044")
    egress_usd_per_gb: Decimal = Decimal("0.09")

    def __post_init__(self) -> None:
        integer_limits = (
            self.max_active_storage_bytes,
            self.max_workspace_storage_bytes,
            self.max_write_requests_per_month,
            self.max_read_requests_per_month,
            self.max_egress_bytes_per_month,
            self.retention_hours,
        )
        if any(limit <= 0 for limit in integer_limits):
            raise ValueError("Artifact storage limits must be positive.")
        if self.max_workspace_storage_bytes > self.max_active_storage_bytes:
            raise ValueError("Workspace storage cannot exceed the global storage limit.")
        if self.retention_hours > 24:
            raise ValueError("Artifact source retention cannot exceed 24 hours.")
        if self.estimated_maximum_monthly_cost_usd() >= self.billing_ceiling_usd:
            raise ValueError("Artifact storage limits do not leave room below the billing ceiling.")

    def estimated_maximum_monthly_cost_usd(self) -> Decimal:
        bytes_per_decimal_gb = Decimal(1_000_000_000)
        storage = (
            Decimal(self.max_active_storage_bytes)
            / bytes_per_decimal_gb
            * self.storage_usd_per_gb_month
        )
        writes = (
            Decimal(self.max_write_requests_per_month) / Decimal(1_000) * self.writes_usd_per_1000
        )
        reads = (
            Decimal(self.max_read_requests_per_month) / Decimal(10_000) * self.reads_usd_per_10000
        )
        egress = (
            Decimal(self.max_egress_bytes_per_month) / bytes_per_decimal_gb * self.egress_usd_per_gb
        )
        return storage + writes + reads + egress


@dataclass(frozen=True)
class ArtifactObject:
    artifact_id: str
    workspace_id: str
    provider: str
    bucket: str
    object_key: str
    size_bytes: int
    content_sha256: str
    media_type: str
    status: ArtifactObjectStatus
    expires_at: datetime
    etag: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    stored_at: datetime | None = None
    deleted_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.size_bytes <= 0:
            raise ValueError("Artifact source size must be positive.")
        if len(self.content_sha256) != 64:
            raise ValueError("Artifact source hash must be a SHA-256 digest.")
        if self.expires_at.tzinfo is None:
            raise ValueError("Artifact source expiry must be timezone-aware.")


@dataclass(frozen=True)
class ArtifactStorageUsage:
    period_start: date
    active_bytes: int
    reserved_bytes: int
    write_requests: int
    read_requests: int
    egress_bytes: int


@dataclass(frozen=True)
class SourceRetention:
    status: str
    size_bytes: int | None = None
    expires_at: datetime | None = None

    def to_dict(self) -> dict[str, int | str | None]:
        return {
            "status": self.status,
            "size_bytes": self.size_bytes,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }
