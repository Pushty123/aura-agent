# AURA — Personal Intelligence System

**wHACKiest 2026 · Track 3 – Know Thyself: Your Data. Your Intelligence. · Team Phoenix, East Point College of Engineering**

AURA turns your own daily data (sleep, movement, screen time, food, mood) into plain-language insights, while keeping that data **encrypted on your device and under your control**.

This repository is the **working base** for the hackathon build: a runnable MVP skeleton with the hard, risky parts (encryption, consent, audit, insight engine) already done and tested, so the team can spend the 3 days on features and polish.

## Quick start

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm test             # 28 unit tests
npm run build
```

Optional blind relay (encrypted backup server):

```bash
cd relay
pip install -r requirements.txt
uvicorn main:app --port 8787
python -m pytest -q
```

Android (Capacitor): see [docs/ANDROID_PLUGIN.md](docs/ANDROID_PLUGIN.md).

## What is built (and tested)

| Area | What it does |
|---|---|
| Encrypted vault | PBKDF2-SHA256 (310k) → HKDF per record → AES-256-GCM, record id bound as AAD. WebCrypto only. |
| Crypto-shredding | "Delete everything" destroys salt + key check; leftover data is unreadable. |
| Consent | Per-source toggles; switching a source off deletes its records. |
| Audit log | SHA-256 hash chain; tampering is detected on verify. |
| Network ledger | Every request AURA makes goes through `ledgerFetch` and is shown with bytes sent. |
| Insight engine | Plain statistics (median/MAD, Spearman, permutation test). Late-screen→sleep and sleep-debt detectors, with "not enough data yet" states. |
| Balance score | 0–100 from sleep, movement, screen, check-in, with reasons. |
| Food log | Typed text → approximate calories from a small local table. |
| Ask AURA | Typed commands (alarm / calendar event) always shown on a Confirm card first. |
| Demo data | 30 days of synthetic data, clearly labelled DEMO everywhere. |
| Blind relay | FastAPI + SQLite storing ciphertext blobs under random mailbox IDs. |

## What is NOT built (roadmap)

On-device LLM, multi-device pairing (PAKE), redaction gateway, hardware-backed keys, leaderboards. Do not claim these in the demo. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Honest claims

- Not "100% on-device" or "unhackable": data is encrypted at rest; the optional relay only receives ciphertext.
- Wellness, not medical advice. Calorie values are approximate.
- "AI" here means statistics; it says "not enough data yet" instead of guessing.

## Layout

```
app/       React + Vite + TypeScript + Capacitor
  src/lib        crypto, vault, ledger, db, relay client, demo data
  src/insights   stats, detectors, engine, balance score
  src/food, commands, native, pages, components
  tests/
relay/     FastAPI blind relay + tests
docs/      architecture, roadmap, team tasks, privacy, android plugin
```

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Team tasks](docs/TEAM_TASKS.md) · [Privacy model](docs/PRIVACY.md) · [Android plugin](docs/ANDROID_PLUGIN.md)

License: MIT
