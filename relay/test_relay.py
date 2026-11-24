import os
import tempfile

os.environ["AURA_RELAY_DB"] = os.path.join(tempfile.mkdtemp(), "t.db")

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

c = TestClient(app)
MB = "abcdefghijklmnop1234"


def test_roundtrip_and_delete():
    assert c.put(f"/v1/mailbox/{MB}/blob/1", content=b"\x00\x01ciphertext").status_code == 200
    assert c.get(f"/v1/mailbox/{MB}").json()["blobs"][0]["bytes"] == 12
    assert c.get(f"/v1/mailbox/{MB}/blob/1").content == b"\x00\x01ciphertext"
    assert c.delete(f"/v1/mailbox/{MB}").json()["deleted"] == 1
    assert c.get(f"/v1/mailbox/{MB}/blob/1").status_code == 404


def test_rejects_weak_ids_empty_and_oversized():
    assert c.put("/v1/mailbox/short/blob/1", content=b"x").status_code == 400
    assert c.put(f"/v1/mailbox/{MB}/blob/1", content=b"").status_code == 400
    assert c.put(f"/v1/mailbox/{MB}/blob/1", content=b"x" * (256 * 1024 + 1)).status_code == 413
