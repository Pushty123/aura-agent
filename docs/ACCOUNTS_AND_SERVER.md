# Accounts, server and camera: how to run

## Account design (zero-knowledge)
- Sign-up uses email + password and a 6-digit email code.
- The password never leaves the phone. The app sends an **auth key** derived from it
  (PBKDF2-SHA256, salt bound to the email). The server stores only a salted scrypt hash of that key.
- The **vault key** that encrypts health data is derived separately with a random local salt, so the
  server cannot read any health data. Forgetting the password means the data cannot be recovered.
- Login is throttled (5 wrong tries, then a 60 second lock). Tokens are HMAC-signed and expire.

## Run the server (Windows, from the repo folder)
```
cd relay
pip install -r requirements.txt
set AURA_DEV_MODE=1
uvicorn main:app --host 0.0.0.0 --port 8787
```
- `AURA_DEV_MODE=1` shows the verification code on the sign-up screen when no email is configured
  (for demos only). For real email set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Production: set `AURA_SECRET` (random string), serve over HTTPS, do not set `AURA_DEV_MODE`.

## Point the phone at the server
Phone and laptop on the same Wi-Fi. Find the laptop IP with `ipconfig` (IPv4 Address), allow
Python through Windows Firewall, then either type `http://<laptop-ip>:8787` under **Server address**
on the sign-up screen, or create `app/.env.local` with `VITE_AURA_SERVER=http://<laptop-ip>:8787`
before building.

## Camera and exercise
- Profile photo: Capacitor Camera plugin (browser fallback: file picker). Stored encrypted, 320 px.
- Exercise: pose detection runs on the phone with the model bundled in the app (no download, no
  upload). Only rep counts are stored. Squats, push-ups and bicep curls are supported.
- After `cap sync`, `npm run android:prepare` adds the CAMERA permission to the generated Android project.

## Build for the phone
```
cd app
npm install
npm run android:prepare
```
Then run from Android Studio.

## Smart replies (language model)
The app never holds a model key. Set it once on the server:
```
set AURA_LLM_PROVIDER=gemini        # or anthropic, or openai (any OpenAI-compatible API such as Groq)
set AURA_LLM_KEY=your-key-here
set AURA_LLM_MODEL=gemini-2.0-flash # optional for gemini/anthropic; required for openai
uvicorn main:app --host 0.0.0.0 --port 8787
```
- For `openai`-style providers also set `AURA_LLM_BASE_URL` (for example `https://api.groq.com/openai/v1`).
- Never commit the key. It lives only in the server's environment.
- Users opt in inside Ask AURA. Only a summary is sent (see `app/src/lib/ai.ts`): no name, email, allergies,
  blood group, photos or raw records. The server removes emails and phone numbers again, adds the safety prompt
  itself and limits each account to 30 requests an hour (`AURA_LLM_PER_HOUR`).
- If the server has no key, the user is offline, or smart replies are off, Ask AURA falls back to built-in answers.
