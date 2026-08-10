"""Narrow AWS S3 adapter for private, short-lived artifact source objects."""

from __future__ import annotations

from typing import Any, Protocol

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:  # pragma: no cover - dependency is present in deployed/runtime installs
    boto3 = None
    Config = None
    BotoCoreError = ClientError = Exception

from domain.artifacts.storage import ArtifactStorageProviderError


class ObjectStore(Protocol):
    def put(
        self,
        object_key: str,
        content: bytes,
        *,
        media_type: str,
        content_sha256: str,
    ) -> str | None: ...

    def get(self, object_key: str) -> bytes: ...

    def delete(self, object_key: str) -> None: ...


class InMemoryObjectStore:
    """Deterministic object store used by service and API tests."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(
        self,
        object_key: str,
        content: bytes,
        *,
        media_type: str,
        content_sha256: str,
    ) -> str:
        self.objects[object_key] = bytes(content)
        return f'"test-{content_sha256[:16]}"'

    def get(self, object_key: str) -> bytes:
        try:
            return self.objects[object_key]
        except KeyError as exc:
            raise ArtifactStorageProviderError("Stored artifact source is unavailable.") from exc

    def delete(self, object_key: str) -> None:
        self.objects.pop(object_key, None)


class S3ObjectStore:
    """AWS SDK adapter restricted to PUT, GET, and DELETE on one private bucket."""

    def __init__(
        self,
        *,
        bucket: str,
        region: str,
        client: Any | None = None,
    ) -> None:
        if not bucket:
            raise ValueError("AWS_S3_BUCKET is required.")
        if not region:
            raise ValueError("AWS_S3_REGION is required.")
        if client is None:
            if boto3 is None:
                raise RuntimeError("boto3 is required when artifact storage is enabled.")
            client = boto3.client(
                "s3",
                region_name=region,
                config=Config(retries={"total_max_attempts": 1, "mode": "standard"}),
            )
        self.bucket = bucket
        self.region = region
        self._client = client

    def put(
        self,
        object_key: str,
        content: bytes,
        *,
        media_type: str,
        content_sha256: str,
    ) -> str | None:
        try:
            response = self._client.put_object(
                Bucket=self.bucket,
                Key=object_key,
                Body=content,
                ContentLength=len(content),
                ContentType=media_type,
                Metadata={"content-sha256": content_sha256},
                ServerSideEncryption="AES256",
            )
        except (BotoCoreError, ClientError) as exc:
            raise ArtifactStorageProviderError(
                "AWS S3 could not retain the artifact source."
            ) from exc
        return response.get("ETag")

    def get(self, object_key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=self.bucket, Key=object_key)
            body = response["Body"]
            try:
                return body.read()
            finally:
                close = getattr(body, "close", None)
                if close:
                    close()
        except (BotoCoreError, ClientError, KeyError) as exc:
            raise ArtifactStorageProviderError(
                "AWS S3 could not read the artifact source."
            ) from exc

    def delete(self, object_key: str) -> None:
        try:
            self._client.delete_object(Bucket=self.bucket, Key=object_key)
        except (BotoCoreError, ClientError) as exc:
            raise ArtifactStorageProviderError(
                "AWS S3 could not delete the artifact source."
            ) from exc
