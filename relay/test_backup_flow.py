import os
import tempfile

os.environ.setdefault("AURA_RELAY_DB", os.path.join(tempfile.mkdtemp(), "backup-test.db"))

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

c = TestClient(app)


def test_ciphertext_blob_is_stored_and_returned_unchanged():
    mailbox = "backupflowmailbox123"
    seq = "2026-11-25"
    ciphertext = b"\x00\x01\xffopaque-encrypted-payload"

    uploaded = c.put(
        f"/v1/mailbox/{mailbox}/blob/{seq}",
        content=ciphertext,
        headers={"content-type": "application/octet-stream"},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["bytes"] == len(ciphertext)

    downloaded = c.get(f"/v1/mailbox/{mailbox}/blob/{seq}")
    assert downloaded.status_code == 200
    assert downloaded.content == ciphertext
    assert b"sleepHours" not in downloaded.content
    assert b"7.25" not in downloaded.content


def test_missing_mailbox_and_unknown_blob_return_clean_responses():
    mailbox = "unknownbackupmailbox123"

    assert c.get(f"/v1/mailbox/{mailbox}/blob/missing").status_code == 404
    assert c.get(f"/v1/mailbox/{mailbox}").json() == {"blobs": []}
