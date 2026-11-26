import { db } from './db';
import { PBKDF2_ITERATIONS, toB64 } from './crypto';
import { ledgerFetch } from './ledger';
import { audit } from './vault';

/**
 * Email accounts, zero-knowledge style.
 *
 * The password never leaves the phone. The app sends only an "auth key"
 * derived from it (PBKDF2 with an email-bound salt). The vault encryption key
 * is derived separately with a random local salt, so the server, which stores
 * a hash of the auth key, cannot read any health data.
 */
export const DEFAULT_SERVER: string =
  (import.meta.env.VITE_AURA_SERVER as string | undefined) ?? 'http://localhost:8787';

export interface Session {
  email: string;
  token: string;
}

export async function getServer(): Promise<string> {
  const row = await db.meta.get('server');
  return row?.value || DEFAULT_SERVER;
}

export async function setServer(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(clean)) throw new Error('Server address must start with http:// or https://');
  await db.meta.put({ key: 'server', value: clean });
}

export async function getSession(): Promise<Session | null> {
  const row = await db.meta.get('account');
  return row ? (JSON.parse(row.value) as Session) : null;
}

async function saveSession(s: Session): Promise<void> {
  await db.meta.put({ key: 'account', value: JSON.stringify(s) });
}

export async function deriveAuthKey(password: string, email: string): Promise<string> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`aura-auth-v1:${email.trim().toLowerCase()}`), iterations: PBKDF2_ITERATIONS },
    base,
    256,
  );
  return toB64(new Uint8Array(bits)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export class AccountError extends Error {}

/**
 * Calls the AURA server. Every call has a time limit, so a laptop server that is
 * off or on another Wi-Fi never leaves the app waiting for minutes.
 */
export async function apiCall<T>(path: string, init: RequestInit & { label: string; timeoutMs?: number }): Promise<T> {
  const server = await getServer();
  const { timeoutMs = 15_000, ...rest } = init;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let res: Response;
  try {
    res = await Promise.race([
      ledgerFetch(`${server}${path}`, {
        ...rest,
        signal: ctrl?.signal,
        headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ctrl?.abort();
          reject(new Error(`no answer in ${Math.round(timeoutMs / 1000)} s`));
        }, timeoutMs);
      }),
    ]);
  } catch (e) {
    const why = e instanceof Error && e.message ? ` (${e.message.slice(0, 120)})` : '';
    throw new AccountError(`Could not reach the AURA server at ${server}. Check the Wi-Fi and the server address.${why}`);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: unknown }).detail;
    throw new AccountError(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.');
  }
  return data as T;
}

export interface RegisterResult {
  email: string;
  emailed: boolean;
  /** Only present when the server runs in demo mode without email. */
  dev_code?: string;
}

export async function register(email: string, password: string): Promise<RegisterResult> {
  const auth_key = await deriveAuthKey(password, email);
  return apiCall<RegisterResult>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, auth_key }),
    label: 'account-signup (login key only, never the password)',
  });
}

export async function verify(email: string, code: string): Promise<Session> {
  const r = await apiCall<Session>('/v1/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    label: 'email-verification-code',
  });
  await saveSession(r);
  return r;
}

export async function login(email: string, password: string): Promise<Session> {
  const auth_key = await deriveAuthKey(password, email);
  const r = await apiCall<Session>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, auth_key }),
    label: 'account-login (login key only, never the password)',
  });
  await saveSession(r);
  return r;
}

/** Call after the vault exists so the audit entry can be written. */
export async function noteSignedIn(email: string): Promise<void> {
  await audit('account.signin', `Signed in as ${email.replace(/(.).+(@.+)/, '$1***$2')}`);
}

/** Signs out of the AURA account on this phone. Your encrypted data stays on the phone. */
export async function logout(): Promise<void> {
  const s = await getSession();
  await db.meta.delete('account');
  if (s) await audit('account.signout', `Signed out ${s.email.replace(/(.).+(@.+)/, '$1***$2')}`);
}
