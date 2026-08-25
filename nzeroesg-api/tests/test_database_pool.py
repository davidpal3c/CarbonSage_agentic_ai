from types import SimpleNamespace

import persistence.database as database


class FakePool:
    def __init__(self, **configuration):
        self.configuration = configuration
        self.open_calls = []
        self.closed = False

    def open(self, *, wait):
        self.open_calls.append(wait)

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self, transaction_status):
        self.closed = False
        self.info = SimpleNamespace(transaction_status=transaction_status)
        self.rollback_calls = 0

    def rollback(self):
        self.rollback_calls += 1


class FakeLeasePool:
    def __init__(self):
        self.returned = []

    def putconn(self, connection):
        self.returned.append(connection)


def test_database_pool_is_lazy_bounded_and_shared(monkeypatch):
    created = []

    def create_pool(**configuration):
        pool = FakePool(**configuration)
        created.append(pool)
        return pool

    monkeypatch.setattr(database, "ConnectionPool", create_pool)
    monkeypatch.setattr(database, "_pools", {})

    first = database.database_pool("postgresql://example.invalid/database")
    second = database.database_pool("postgresql://example.invalid/database")

    assert first is second
    assert len(created) == 1
    assert first.configuration["min_size"] == 0
    assert first.configuration["max_size"] == 4
    assert first.open_calls == [False]

    database.close_database_pools()

    assert first.closed is True
    assert database._pools == {}


def test_returning_a_pool_lease_rolls_back_an_open_transaction_once():
    pool = FakeLeasePool()
    connection = FakeConnection(database.TransactionStatus.INTRANS)
    lease = database.PooledConnectionLease(pool, connection)

    lease.close()
    lease.close()

    assert connection.rollback_calls == 1
    assert pool.returned == [connection]


def test_returning_an_idle_pool_lease_does_not_issue_a_rollback():
    pool = FakeLeasePool()
    connection = FakeConnection(database.TransactionStatus.IDLE)

    database.PooledConnectionLease(pool, connection).close()

    assert connection.rollback_calls == 0
    assert pool.returned == [connection]
