from db import to_postgres


def test_translates_sqlite_sql_for_postgres():
    assert to_postgres("SELECT a FROM t WHERE x=? AND y=?") == "SELECT a FROM t WHERE x=%s AND y=%s"
    sql = to_postgres("INSERT OR REPLACE INTO blobs (mailbox, seq, data, ts) VALUES (?,?,?,?)")
    assert sql.startswith("INSERT INTO blobs (mailbox, seq, data, ts) VALUES (%s,%s,%s,%s) ON CONFLICT (mailbox, seq)")
    assert "data=EXCLUDED.data" in sql and "mailbox=EXCLUDED" not in sql
    assert "BYTEA" in to_postgres("CREATE TABLE s (v BLOB NOT NULL, t REAL)")
    assert "DOUBLE PRECISION" in to_postgres("CREATE TABLE s (v BLOB NOT NULL, t REAL)")
    assert "OCTET_LENGTH(data)" in to_postgres("SELECT LENGTH(data) FROM blobs")
