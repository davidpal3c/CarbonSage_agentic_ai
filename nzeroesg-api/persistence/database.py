"""Small lazy PostgreSQL pool shared by all persistence adapters."""

from __future__ import annotations

import threading
from typing import Any

try:
    from psycopg.pq import TransactionStatus
    from psycopg_pool import ConnectionPool
except ImportError:  # pragma: no cover - exercised only before dependency setup
    TransactionStatus = None
    ConnectionPool = None

from config import settings

_pools: dict[str, Any] = {}
_pools_lock = threading.Lock()


def database_pool(database_url: str):
    """Return one lazily opened, low-concurrency pool per connection string."""

    if ConnectionPool is None:
        raise RuntimeError("psycopg_pool is required when DATABASE_URL is configured.")
    with _pools_lock:
        pool = _pools.get(database_url)
        if pool is None:
            pool = ConnectionPool(
                conninfo=database_url,
                min_size=settings.database_pool_min_size,
                max_size=settings.database_pool_max_size,
                timeout=settings.database_pool_timeout_seconds,
                max_idle=settings.database_pool_max_idle_seconds,
                open=False,
                name="carbonsage-api",
            )
            pool.open(wait=False)
            _pools[database_url] = pool
        return pool


class PooledConnectionLease:
    """Adapt a pooled connection to repositories that close their connection."""

    def __init__(self, pool: Any, connection: Any) -> None:
        self._pool = pool
        self._connection = connection
        self._returned = False

    def __getattr__(self, name: str) -> Any:
        return getattr(self._connection, name)

    def close(self) -> None:
        if self._returned:
            return
        self._returned = True
        try:
            if (
                TransactionStatus is not None
                and not self._connection.closed
                and self._connection.info.transaction_status != TransactionStatus.IDLE
            ):
                self._connection.rollback()
        finally:
            self._pool.putconn(self._connection)


def pooled_connect(database_url: str) -> PooledConnectionLease:
    pool = database_pool(database_url)
    return PooledConnectionLease(pool, pool.getconn())


def close_database_pools() -> None:
    """Close all application pools during process shutdown."""

    with _pools_lock:
        pools = tuple(_pools.values())
        _pools.clear()
    for pool in pools:
        pool.close()


def database_pool_stats(database_url: str) -> dict[str, int]:
    """Expose aggregate pool counters for diagnostics and integration tests."""

    return dict(database_pool(database_url).get_stats())
