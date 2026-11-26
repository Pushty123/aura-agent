import base64
import os
import tempfile

os.environ["AURA_RELAY_DB"] = os.path.join(tempfile.mkdtemp(), "voice.db")
os.environ["AURA_DEV_MODE"] = "1"
os.environ.pop("AURA_ELEVEN_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
import voice  # noqa: E402
from main import app  # noqa: E402

c = TestClient(app)
H = {"Authorization": f"Bearer {auth.make_token('me@x.com')}"}


def on(monkeypatch, seen=None):
    monkeypatch.setenv("AURA_ELEVEN_KEY", "eleven-secret")
    monkeypatch.setattr(voice, "eleven_tts", lambda text, v: (seen.append((text, v)) if seen is not None else None) or b"ID3fake")
    monkeypatch.setattr(voice, "eleven_stt", lambda audio, mime: "I have a headache")


def test_status_and_not_configured():
    assert c.get("/v1/voice/status").json() == {"enabled": False}
    assert c.post("/v1/voice/speak", json={"text": "hi"}, headers=H).status_code == 503


def test_requires_login(monkeypatch):
    on(monkeypatch)
    assert c.post("/v1/voice/speak", json={"text": "hi"}).status_code == 401
    assert c.post("/v1/voice/transcribe", json={"audio": "eA=="}).status_code == 401


def test_speak_returns_audio_and_rejects_bad_voice(monkeypatch):
    seen = []
    on(monkeypatch, seen)
    r = c.post("/v1/voice/speak", json={"text": "Drink water", "voice": "../../evil"}, headers=H)
    assert r.status_code == 200 and base64.b64decode(r.json()["audio"]) == b"ID3fake"
    assert seen[0] == ("Drink water", voice.DEFAULT_VOICE)
    assert c.post("/v1/voice/speak", json={"text": "x" * 800}, headers=H).status_code == 422


def test_transcribe(monkeypatch):
    on(monkeypatch)
    clip = lambda b: {"audio": base64.b64encode(b).decode(), "mime": "audio/webm"}
    assert c.post("/v1/voice/transcribe", json=clip(b"audio"), headers=H).json() == {"text": "I have a headache"}
    assert c.post("/v1/voice/transcribe", json=clip(b""), headers=H).status_code == 400
    assert c.post("/v1/voice/transcribe", json={"audio": "not base64!"}, headers=H).status_code == 400
    assert c.post("/v1/voice/transcribe", json=clip(b"x" * 2_000_001), headers=H).status_code == 413


def test_rate_limit(monkeypatch):
    on(monkeypatch)
    monkeypatch.setenv("AURA_VOICE_PER_HOUR", "2")
    h = {"Authorization": f"Bearer {auth.make_token('rate@x.com')}"}
    codes = [c.post("/v1/voice/speak", json={"text": "hi"}, headers=h).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
