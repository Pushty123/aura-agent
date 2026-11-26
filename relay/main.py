"""AURA blind relay: stores opaque ciphertext blobs under random mailbox IDs.

It never sees plaintext, keys, names or emails. Optional: AURA works fully
offline without it. Run:  uvicorn main:app --port 8787
"""
import os
import re
import sqlite3
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from llm import router as llm_router
from voice import router as voice_router

DB_PATH = os.environ.get("AURA_RELAY_DB", "relay.db")
MAX_BLOB = 256 * 1024  # bytes per blob
MAX_BLOBS_PER_MAILBOX = 5000
ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")

app = FastAPI(title="AURA relay and accounts", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    # The app (Android), local dev servers, the shared GitHub Pages link, plus any extra
    # origins in AURA_CORS_ORIGINS (comma-separated), e.g. a tunnel address.
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "capacitor://localhost",
        "http://localhost",
        "https://localhost",
        "https://pushty123.github.io",
        *[o.strip() for o in os.environ.get("AURA_CORS_ORIGINS", "").split(",") if o.strip()],
    ],
    allow_methods=["GET", "PUT", "POST", "DELETE"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(llm_router)
app.include_router(voice_router)


def conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.execute(
        "CREATE TABLE IF NOT EXISTS blobs (mailbox TEXT NOT NULL, seq TEXT NOT NULL, "
        "data BLOB NOT NULL, ts REAL NOT NULL, PRIMARY KEY (mailbox, seq))"
    )
    return c


def check(mailbox: str) -> None:
    if not ID_RE.match(mailbox):
        raise HTTPException(400, "mailbox id must be 16-64 url-safe chars (use a random id)")


@app.get("/health")
def health():
    return {"ok": True}


@app.put("/v1/mailbox/{mailbox}/blob/{seq}")
async def put_blob(mailbox: str, seq: str, request: Request):
    check(mailbox)
    if not re.match(r"^[A-Za-z0-9:_.-]{1,128}$", seq):
        raise HTTPException(400, "bad seq")
    body = await request.body()
    if not body:
        raise HTTPException(400, "empty body")
    if len(body) > MAX_BLOB:
        raise HTTPException(413, "blob too large")
    with conn() as c:
        n = c.execute("SELECT COUNT(*) FROM blobs WHERE mailbox=?", (mailbox,)).fetchone()[0]
        if n >= MAX_BLOBS_PER_MAILBOX:
            raise HTTPException(429, "mailbox full")
        c.execute(
            "INSERT OR REPLACE INTO blobs (mailbox, seq, data, ts) VALUES (?,?,?,?)",
            (mailbox, seq, body, time.time()),
        )
    return {"stored": seq, "bytes": len(body)}


@app.get("/v1/mailbox/{mailbox}")
def list_blobs(mailbox: str):
    check(mailbox)
    with conn() as c:
        rows = c.execute(
            "SELECT seq, LENGTH(data), ts FROM blobs WHERE mailbox=? ORDER BY ts", (mailbox,)
        ).fetchall()
    return {"blobs": [{"seq": s, "bytes": b, "ts": t} for s, b, t in rows]}


@app.get("/v1/mailbox/{mailbox}/blob/{seq}")
def get_blob(mailbox: str, seq: str):
    from fastapi.responses import Response

    check(mailbox)
    with conn() as c:
        row = c.execute("SELECT data FROM blobs WHERE mailbox=? AND seq=?", (mailbox, seq)).fetchone()
    if not row:
        raise HTTPException(404, "not found")
    return Response(content=row[0], media_type="application/octet-stream")


@app.delete("/v1/mailbox/{mailbox}")
def delete_mailbox(mailbox: str):
    check(mailbox)
    with conn() as c:
        n = c.execute("DELETE FROM blobs WHERE mailbox=?", (mailbox,)).rowcount
    return {"deleted": n}
