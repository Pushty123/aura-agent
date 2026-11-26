"""AURA smart replies: a thin, safe proxy to a language model.

The model key lives only in this server's environment (never in the app or the
repository). The app sends a short *summary* of patterns, never raw records,
names, emails or photos. This server adds the safety prompt itself, so the app
cannot override it, and it limits how often each account can call it.

Environment:
  AURA_LLM_PROVIDER  anthropic | gemini | openai   (openai = any OpenAI-compatible API)
  AURA_LLM_KEY       the provider API key
  AURA_LLM_MODEL     model name (defaults exist for anthropic and gemini)
  AURA_LLM_BASE_URL  only for provider=openai, e.g. https://api.groq.com/openai/v1
  AURA_LLM_PER_HOUR  requests per account per hour (default 30)
"""
import os
import re
import time

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from auth import conn, current_email

router = APIRouter(prefix="/v1", tags=["smart-replies"])

SYSTEM_PROMPT = (
    "You are AURA, a warm, concise wellness companion inside a personal health-patterns app. "
    "You talk with one person about their own sleep, movement, screen time, food, mood and exercise.\n"
    "Rules:\n"
    "- Use ONLY the numbers in the CONTEXT block. If something is not in it, say you do not have that data. "
    "Never invent statistics, dates or results.\n"
    "- Explain patterns in plain, kind language and suggest one small, practical next step.\n"
    "- You are a wellness tool, not a doctor. Do not diagnose, name medicines or doses, or give treatment advice. "
    "For symptoms that worry the person, or any thought of self-harm, gently encourage them to talk to a doctor, a trusted person or a local helpline.\n"
    "- Keep answers under 120 words. Plain text, no markdown tables.\n"
    "- If the context says the data is DEMO sample data, mention that it is sample data.\n"
    "- You cannot set alarms or change anything. If asked, say the person can use the command box and confirm."
)

MAX_CONTEXT = 4000
MAX_QUESTION = 500
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\s-]?){9,14}(?!\d)")


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=MAX_QUESTION * 3)


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_QUESTION)
    context: str = Field(min_length=1, max_length=MAX_CONTEXT)
    history: list[Turn] = Field(default_factory=list, max_length=6)


def scrub(text: str) -> str:
    """Defence in depth: remove anything that looks like an email or a phone number."""
    return PHONE_RE.sub("[removed]", EMAIL_RE.sub("[removed]", text))


def configured() -> bool:
    return bool(os.environ.get("AURA_LLM_KEY") and os.environ.get("AURA_LLM_PROVIDER"))


def check_rate(email: str) -> None:
    limit = int(os.environ.get("AURA_LLM_PER_HOUR", "30"))
    now = time.time()
    with conn() as c:
        c.execute("CREATE TABLE IF NOT EXISTS llm_calls (email TEXT NOT NULL, ts REAL NOT NULL)")
        c.execute("DELETE FROM llm_calls WHERE ts < ?", (now - 3600,))
        n = c.execute("SELECT COUNT(*) FROM llm_calls WHERE email=?", (email,)).fetchone()[0]
        if n >= limit:
            raise HTTPException(429, "You have used all smart replies for this hour. Try again later.")
        c.execute("INSERT INTO llm_calls (email, ts) VALUES (?, ?)", (email, now))


def call_provider(system: str, messages: list[dict]) -> tuple[str, str]:
    """Returns (reply, model). Raises HTTPException with a safe message on failure."""
    provider = os.environ["AURA_LLM_PROVIDER"].lower()
    key = os.environ["AURA_LLM_KEY"]
    model = os.environ.get("AURA_LLM_MODEL", "")
    try:
        with httpx.Client(timeout=40) as http:
            if provider == "anthropic":
                model = model or "claude-haiku-5-5"
                r = http.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                    json={"model": model, "max_tokens": 400, "system": system, "messages": messages},
                )
                r.raise_for_status()
                return "".join(b.get("text", "") for b in r.json()["content"]).strip(), model
            if provider == "gemini":
                model = model or "gemini-2.5-flash-lite"
                r = http.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": key},
                    json={
                        "system_instruction": {"parts": [{"text": system}]},
                        "contents": [
                            {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
                            for m in messages
                        ],
                        "generationConfig": {"maxOutputTokens": 400},
                    },
                )
                r.raise_for_status()
                parts = r.json()["candidates"][0]["content"]["parts"]
                return "".join(p.get("text", "") for p in parts).strip(), model
            if provider == "openai":
                base = os.environ.get("AURA_LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
                if not model:
                    raise HTTPException(503, "The server has no model name set (AURA_LLM_MODEL).")
                r = http.post(
                    f"{base}/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={
                        "model": model,
                        "max_tokens": 400,
                        "messages": [{"role": "system", "content": system}, *messages],
                    },
                )
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"].strip(), model
    except HTTPException:
        raise
    except Exception:
        # Never leak provider details or the key.
        raise HTTPException(502, "The smart reply service did not answer. Please try again.")
    raise HTTPException(503, "The server's AI provider setting is not recognised.")


@router.get("/chat/status")
def status():
    return {"enabled": configured()}


@router.post("/chat")
def chat(body: ChatIn, authorization: str | None = Header(default=None)):
    email = current_email(authorization)
    if not configured():
        raise HTTPException(503, "Smart replies are not set up on this server yet.")
    check_rate(email)
    system = f"{SYSTEM_PROMPT}\n\nCONTEXT (the person's own summarised data):\n{scrub(body.context)}"
    messages = [{"role": t.role, "content": scrub(t.content)} for t in body.history]
    messages.append({"role": "user", "content": scrub(body.question)})
    reply, model = call_provider(system, messages)
    if not reply:
        raise HTTPException(502, "The smart reply service sent an empty answer. Please try again.")
    return {"reply": reply, "model": model}
