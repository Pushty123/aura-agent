import os
import tempfile

os.environ["AURA_RELAY_DB"] = os.path.join(tempfile.mkdtemp(), "auth.db")
os.environ["AURA_DEV_MODE"] = "1"
os.environ.pop("SMTP_HOST", None)

import time  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from main import app  # noqa: E402

c = TestClient(app)
KEY = "k" * 43
OTHER = "z" * 43


def signup(email="a@b.com", key=KEY):
    r = c.post("/v1/auth/register", json={"email": email, "auth_key": key})
    assert r.status_code == 200, r.text
    return r.json()


def test_full_flow_register_verify_login_me_delete():
    out = signup()
    assert out["status"] == "verify" and len(out["dev_code"]) == 6
    v = c.post("/v1/auth/verify", json={"email": "a@b.com", "code": out["dev_code"]})
    assert v.status_code == 200
    token = v.json()["token"]
    me = c.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json() == {"email": "a@b.com"}
    lg = c.post("/v1/auth/login", json={"email": "A@B.com ", "auth_key": KEY})
    assert lg.status_code == 200
    d = c.delete("/v1/auth/me", headers={"Authorization": f"Bearer {lg.json()['token']}"})
    assert d.json() == {"deleted": 1}
    assert c.post("/v1/auth/login", json={"email": "a@b.com", "auth_key": KEY}).status_code == 401


def test_wrong_code_and_unverified_login_blocked():
    out = signup("u@x.com")
    bad = "000000" if out["dev_code"] != "000000" else "111111"
    assert c.post("/v1/auth/verify", json={"email": "u@x.com", "code": bad}).status_code == 400
    assert c.post("/v1/auth/login", json={"email": "u@x.com", "auth_key": KEY}).status_code == 403


def test_duplicate_verified_email_rejected():
    out = signup("d@x.com")
    c.post("/v1/auth/verify", json={"email": "d@x.com", "code": out["dev_code"]})
    r = c.post("/v1/auth/register", json={"email": "d@x.com", "auth_key": OTHER})
    assert r.status_code == 409


def test_wrong_password_throttled_after_five():
    out = signup("t@x.com")
    c.post("/v1/auth/verify", json={"email": "t@x.com", "code": out["dev_code"]})
    for _ in range(5):
        assert c.post("/v1/auth/login", json={"email": "t@x.com", "auth_key": OTHER}).status_code == 401
    r = c.post("/v1/auth/login", json={"email": "t@x.com", "auth_key": KEY})
    assert r.status_code == 429


def test_tokens_cannot_be_forged_or_expired():
    assert c.get("/v1/auth/me").status_code == 401
    assert c.get("/v1/auth/me", headers={"Authorization": "Bearer abc.def"}).status_code == 401
    old = auth.make_token("a@b.com", ttl=-5)
    assert c.get("/v1/auth/me", headers={"Authorization": f"Bearer {old}"}).status_code == 401
    good = auth.make_token("a@b.com")
    p, s = good.split(".")
    forged = p + "." + ("A" if s[0] != "A" else "B") + s[1:]
    assert c.get("/v1/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_server_never_stores_the_auth_key_in_plain():
    signup("s@x.com", "q" * 43)
    with auth.conn() as db:
        row = db.execute("SELECT salt, key_hash FROM users WHERE email='s@x.com'").fetchone()
    assert b"q" * 10 not in row[1] and row[1] != ("q" * 43).encode()


def test_no_email_without_smtp_and_without_dev_mode_fails_closed():
    os.environ["AURA_DEV_MODE"] = "0"
    try:
        r = c.post("/v1/auth/register", json={"email": "n@x.com", "auth_key": KEY})
        assert r.status_code == 503
    finally:
        os.environ["AURA_DEV_MODE"] = "1"


def test_bad_email_rejected():
    r = c.post("/v1/auth/register", json={"email": "not-an-email", "auth_key": KEY})
    assert r.status_code == 400
