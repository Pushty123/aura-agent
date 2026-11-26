"""Database connection for the AURA server.

Local laptop: a SQLite file (AURA_RELAY_DB, default relay.db).
Online (Render etc.): set DATABASE_URL to a PostgreSQL address. Free hosts wipe
local files when they restart, so accounts must live in a real database there.

The rest of the server writes plain SQLite-style SQL; this module translates it
for PostgreSQL (placeholders, types, INSERT OR REPLACE, LENGTH).
"""
import os
import re
import sqlite3

# Primary keys, for turning INSERT OR REPLACE into an upsert.
CONFLICT_KEYS = {"users": ["email"], "secrets": ["name"], "blobs": ["mailbox", "seq"]}

_REPLACE = re.compile(r"INSERT OR REPLACE INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)", re.I)


def to_postgres(sql: str) -> str:
    """Translate the SQLite dialect used in this server to PostgreSQL."""
    m = _REPLACE.search(sql)
    if m:
        table, cols, vals = m.group(1), [c.strip() for c in m.group(2).split(",")], m.group(3)
        keys = CONFLICT_KEYS[table]
        upd = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c not in keys)
        sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({vals}) ON CONFLICT ({', '.join(keys)}) DO UPDATE SET {upd}"
    sql = re.sub(r"\bBLOB\b", "BYTEA", sql)
    sql = re.sub(r"\bREAL\b", "DOUBLE PRECISION", sql)
    sql = re.sub(r"\bLENGTH\(", "OCTET_LENGTH(", sql)
    return sql.replace("?", "%s")


class _PgCursor:
    def __init__(self, cur):
        self._cur = cur

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount

    @staticmethod
    def _fix(row):
        return None if row is None else tuple(bytes(v) if isinstance(v, memoryview) else v for v in row)

    def fetchone(self):
        return self._fix(self._cur.fetchone())

    def fetchall(self):
        return [self._fix(r) for r in self._cur.fetchall()]


class _PgConn:
    """Looks like a sqlite3 connection: execute(), and `with` commits or rolls back."""

    def __init__(self, url: str):
        import psycopg  # only needed online

        self._c = psycopg.connect(url, autocommit=False)

    def execute(self, sql: str, params=()):
        cur = self._c.cursor()
        cur.execute(to_postgres(sql), tuple(params))
        return _PgCursor(cur)

    def commit(self) -> None:
        self._c.commit()

    def rollback(self) -> None:
        self._c.rollback()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        try:
            if exc_type:
                self._c.rollback()
            else:
                self._c.commit()
        finally:
            self._c.close()
        return False


def using_postgres() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


def connect(sqlite_path: str):
    url = os.environ.get("DATABASE_URL")
    if url:
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        return _PgConn(url)
    return sqlite3.connect(sqlite_path)
