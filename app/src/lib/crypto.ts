/**
 * Browser-native crypto only (WebCrypto). No third-party crypto libraries.
 *
 *   passphrase --PBKDF2-SHA256--> vault key (256-bit, HKDF key material)
 *   vault key  --HKDF(recordId|purpose)--> per-record AES-256-GCM key
 *   record     --AES-256-GCM (AAD = recordId)--> ciphertext
 *
 * Deleting the salt + check blob destroys the only way to re-derive the key
 * ("crypto-shredding"): what is left on disk is unreadable noise.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 310_000;

export interface Sealed {
  iv: string; // base64
  ct: string; // base64
}

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Derive the vault key material from a passphrase and salt. */
export async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    256,
  );
  return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
}

async function recordKey(vaultKey: CryptoKey, recordId: string, purpose: string): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(`${purpose}|${recordId}`) },
    vaultKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(vaultKey: CryptoKey, recordId: string, purpose: string, value: unknown): Promise<Sealed> {
  const key = await recordKey(vaultKey, recordId, purpose);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(recordId) },
    key,
    enc.encode(JSON.stringify(value)),
  );
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function open<T>(vaultKey: CryptoKey, recordId: string, purpose: string, sealed: Sealed): Promise<T> {
  const key = await recordKey(vaultKey, recordId, purpose);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: enc.encode(recordId) },
    key,
    fromB64(sealed.ct),
  );
  return JSON.parse(dec.decode(pt)) as T;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
