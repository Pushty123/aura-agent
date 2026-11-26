"""AURA voice: ElevenLabs text-to-speech and speech-to-text through this server.

The ElevenLabs key lives only in this server's environment. The app sends the
short reply text to be spoken, or a short voice clip to be turned into text.
Nothing is stored here. If no key is set, the app uses the phone's built-in
voice instead.

Environment:
  AURA_ELEVEN_KEY       ElevenLabs API key
  AURA_ELEVEN_MODEL     text-to-speech model (default eleven_flash_v2_5)
  AURA_ELEVEN_VOICE     default voice id
  AURA_VOICE_PER_HOUR   voice requests per account per hour (default 40)
"""
import base64
import binascii
import os
import re
import time

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from auth import conn, current_email

router = APIRouter(prefix="/v1/voice", tags=["voice"])
API = "https://api.elevenlabs.io/v1"
MAX_TEXT = 700
MAX_AUDIO = 2_000_000  # about a minute of compressed speech
VOICE_ID = re.compile(r"^[A-Za-z0-9]{8,40}$")
# Stock ElevenLabs voices (free tier). The app picks one per avatar character.
DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel


def key() -> str:
    return os.environ.get("AURA_ELEVEN_KEY", "")


def check_rate(email: str) -> None:
    limit = int(os.environ.get("AURA_VOICE_PER_HOUR", "40"))
    now = time.time()
    with conn() as c:
        c.execute("CREATE TABLE IF NOT EXISTS voice_calls (email TEXT NOT NULL, ts REAL NOT NULL)")
        c.execute("DELETE FROM voice_calls WHERE ts < ?", (now - 3600,))
        if c.execute("SELECT COUNT(*) FROM voice_calls WHERE email=?", (email,)).fetchone()[0] >= limit:
            raise HTTPException(429, "Voice limit reached for this hour. Using the phone voice instead.")
        c.execute("INSERT INTO voice_calls (email, ts) VALUES (?, ?)", (email, now))


@router.get("/status")
def status():
    return {"enabled": bool(key())}


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT)
    voice: str | None = None


def eleven_tts(text: str, voice: str) -> bytes:
    model = os.environ.get("AURA_ELEVEN_MODEL", "eleven_flash_v2_5")
    try:
        with httpx.Client(timeout=30) as http:
            r = http.post(
                f"{API}/text-to-speech/{voice}",
                params={"output_format": "mp3_22050_32"},
                headers={"xi-api-key": key(), "Accept": "audio/mpeg"},
                json={"text": text, "model_id": model},
            )
    except httpx.HTTPError:
        raise HTTPException(502, "The voice service did not answer.")
    if r.status_code != 200:
        raise HTTPException(502, "The voice service could not speak this.")
    return r.content


def eleven_stt(audio: bytes, mime: str) -> str:
    ext = "webm" if "webm" in mime else "ogg" if "ogg" in mime else "m4a" if "mp4" in mime or "aac" in mime else "wav"
    try:
        with httpx.Client(timeout=40) as http:
            r = http.post(
                f"{API}/speech-to-text",
                headers={"xi-api-key": key()},
                data={"model_id": os.environ.get("AURA_ELEVEN_STT_MODEL", "scribe_v2")},
                files={"file": (f"clip.{ext}", audio, mime or "application/octet-stream")},
            )
    except httpx.HTTPError:
        raise HTTPException(502, "The voice service did not answer.")
    if r.status_code != 200:
        raise HTTPException(502, "The voice service could not understand the clip.")
    return str(r.json().get("text", "")).strip()


@router.post("/speak")
def speak(body: SpeakIn, authorization: str | None = Header(default=None)):
    email = current_email(authorization)
    if not key():
        raise HTTPException(503, "Voice is not set up on this server.")
    voice = body.voice if body.voice and VOICE_ID.match(body.voice) else os.environ.get("AURA_ELEVEN_VOICE", DEFAULT_VOICE)
    check_rate(email)
    audio = eleven_tts(body.text.strip(), voice)
    # JSON with base64 so it works the same through the Android app's HTTP layer.
    return {"audio": base64.b64encode(audio).decode(), "mime": "audio/mpeg"}


class ClipIn(BaseModel):
    audio: str = Field(max_length=MAX_AUDIO * 4 // 3 + 8)
    mime: str = Field(default="audio/webm", max_length=60)


@router.post("/transcribe")
def transcribe(body: ClipIn, authorization: str | None = Header(default=None)):
    email = current_email(authorization)
    if not key():
        raise HTTPException(503, "Voice is not set up on this server.")
    try:
        audio = base64.b64decode(body.audio, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "The audio could not be read.")
    if not audio:
        raise HTTPException(400, "No audio received.")
    if len(audio) > MAX_AUDIO:
        raise HTTPException(413, "The clip is too long. Keep it under a minute.")
    check_rate(email)
    text = eleven_stt(audio, body.mime)
    return {"text": text[:500]}
