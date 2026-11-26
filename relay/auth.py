"""AURA accounts: email + password sign-up with email verification.

Zero-knowledge design: the app never sends the password. It sends an
"auth key" derived from it (PBKDF2, separate from the vault encryption key),
and this server stores only a salted scrypt hash of that auth key. The server
therefore cannot read anyone's health data and cannot learn the password.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3

import db
import time
from email.message import EmailMessage

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
CODE_TTL = 10 * 60
TOKEN_TTL = 30 * 24 * 3600
FREE_ATTEMPTS = 5
LOCK_SECONDS = 60


def db_path() -> str:
    return os.environ.get("AURA_RELAY_DB", "relay.db")


def conn():
    c = db.connect(db_path())
    c.execute(
        "CREATE TABLE IF NOT EXISTS users ("
        "email TEXT PRIMARY KEY, salt BLOB NOT NULL, key_hash BLOB NOT NULL, "
        "verified INTEGER NOT NULL DEFAULT 0, code_hash BLOB, code_exp REAL, "
        "code_tries INTEGER NOT NULL DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0, "
        "locked_until REAL NOT NULL DEFAULT 0, created REAL NOT NULL)"
    )
    c.execute("CREATE TABLE IF NOT EXISTS secrets (name TEXT PRIMARY KEY, value BLOB NOT NULL)")
    return c


def server_secret() -> bytes:
    env = os.environ.get("AURA_SECRET")
    if env:
        return env.encode()
    with conn() as c:
        row = c.execute("SELECT value FROM secrets WHERE name='token'").fetchone()
        if row:
            return row[0]
        v = secrets.token_bytes(32)
        c.execute("INSERT INTO secrets (name, value) VALUES ('token', ?)", (v,))
        return v


def hash_key(auth_key: str, salt: bytes) -> bytes:
    return hashlib.scrypt(auth_key.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def make_token(email: str, ttl: int = TOKEN_TTL) -> str:
    payload = _b64(json.dumps({"e": email, "x": int(time.time()) + ttl}).encode())
    sig = _b64(hmac.new(server_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_token(token: str) -> str:
    try:
        payload, sig = token.split(".", 1)
        good = _b64(hmac.new(server_secret(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            raise ValueError("signature")
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if data["x"] < time.time():
            raise ValueError("expired")
        return data["e"]
    except Exception:
        raise HTTPException(401, "Please log in again.")


def current_email(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in.")
    return read_token(authorization[7:])


def send_code(email: str, code: str) -> bool:
    """Send the verification code by SMTP. Returns False if SMTP is not set up."""
    host = os.environ.get("SMTP_HOST")
    if not host:
        return False
    msg = EmailMessage()
    msg["Subject"] = "Your AURA verification code"
    msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "aura@localhost"))
    msg["To"] = email
    msg.set_content(f"Your AURA verification code is {code}. It expires in 10 minutes.")
    with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15) as s:
        s.starttls()
        if os.environ.get("SMTP_USER"):
            s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASS", ""))
        s.send_message(msg)
    return True


class Register(BaseModel):
    email: str
    auth_key: str = Field(min_length=32, max_length=256)


class Verify(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)


class Login(BaseModel):
    email: str
    auth_key: str = Field(min_length=32, max_length=256)


def norm(email: str) -> str:
    e = email.strip().lower()
    if not EMAIL_RE.match(e):
        raise HTTPException(400, "That email address does not look right.")
    return e


def issue_code(c: sqlite3.Connection, email: str) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    c.execute(
        "UPDATE users SET code_hash=?, code_exp=?, code_tries=0 WHERE email=?",
        (hashlib.sha256((email + code).encode()).digest(), time.time() + CODE_TTL, email),
    )
    return code


@router.post("/register")
def register(body: Register):
    email = norm(body.email)
    with conn() as c:
        row = c.execute("SELECT verified FROM users WHERE email=?", (email,)).fetchone()
        if row and row[0]:
            raise HTTPException(409, "An account with this email already exists. Log in instead.")
        salt = secrets.token_bytes(16)
        c.execute(
            "INSERT OR REPLACE INTO users (email, salt, key_hash, verified, created) VALUES (?,?,?,0,?)",
            (email, salt, hash_key(body.auth_key, salt), time.time()),
        )
        code = issue_code(c, email)
    sent = False
    try:
        sent = send_code(email, code)
    except Exception:
        sent = False
    out = {"status": "verify", "email": email, "emailed": sent}
    if not sent and os.environ.get("AURA_DEV_MODE") == "1":
        out["dev_code"] = code  # only for local demos, never in production
    elif not sent:
        raise HTTPException(503, "The server could not send email right now. Try again later.")
    return out


@router.post("/verify")
def verify(body: Verify):
    email = norm(body.email)
    with conn() as c:
        row = c.execute(
            "SELECT code_hash, code_exp, code_tries FROM users WHERE email=?", (email,)
        ).fetchone()
        if not row or not row[0]:
            raise HTTPException(400, "No pending verification. Sign up again.")
        code_hash, exp, tries = row
        if tries >= 5 or exp < time.time():
            raise HTTPException(400, "That code expired. Sign up again for a new one.")
        good = hashlib.sha256((email + body.code).encode()).digest()
        if not hmac.compare_digest(good, code_hash):
            c.execute("UPDATE users SET code_tries=code_tries+1 WHERE email=?", (email,))
            raise HTTPException(400, "That code is not right.")
        c.execute("UPDATE users SET verified=1, code_hash=NULL WHERE email=?", (email,))
    return {"token": make_token(email), "email": email}


@router.post("/login")
def login(body: Login):
    email = norm(body.email)
    generic = HTTPException(401, "Email or password is not right.")
    with conn() as c:
        row = c.execute(
            "SELECT salt, key_hash, verified, fails, locked_until FROM users WHERE email=?", (email,)
        ).fetchone()
        if not row:
            hash_key(body.auth_key, b"x" * 16)  # keep timing similar
            raise generic
        salt, key_hash, verified, fails, locked = row
        if locked > time.time():
            raise HTTPException(429, f"Too many attempts. Try again in {int(locked - time.time()) + 1} seconds.")
        if not hmac.compare_digest(hash_key(body.auth_key, salt), key_hash):
            fails += 1
            lock = time.time() + LOCK_SECONDS if fails >= FREE_ATTEMPTS else 0
            c.execute("UPDATE users SET fails=?, locked_until=? WHERE email=?", (0 if lock else fails, lock, email))
            c.commit()
            raise generic
        if not verified:
            raise HTTPException(403, "Please verify your email first. Sign up again to get a new code.")
        c.execute("UPDATE users SET fails=0, locked_until=0 WHERE email=?", (email,))
    return {"token": make_token(email), "email": email}


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    return {"email": current_email(authorization)}


@router.delete("/me")
def delete_me(authorization: str | None = Header(default=None)):
    email = current_email(authorization)
    with conn() as c:
        n = c.execute("DELETE FROM users WHERE email=?", (email,)).rowcount
    return {"deleted": n}
