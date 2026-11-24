/**
 * Network ledger: AURA's own outgoing requests, counted.
 *
 * All network access in the app MUST go through `ledgerFetch`. The Vault screen
 * shows the totals, so "AURA sent 0 bytes of your data" is something you can
 * demonstrate (e.g. with airplane mode on).
 *
 * Honest limit: this counts requests made by AURA's own code. It is not a
 * phone-wide network monitor.
 */

export interface LedgerEntry {
  ts: number;
  host: string;
  method: string;
  bytesOut: number;
  /** What kind of data this request carried, e.g. "ciphertext-blob". */
  label: string;
}

const entries: LedgerEntry[] = [];
const listeners = new Set<() => void>();

export function getLedger(): readonly LedgerEntry[] {
  return entries;
}

export function ledgerTotals() {
  return {
    requests: entries.length,
    bytesOut: entries.reduce((s, e) => s + e.bytesOut, 0),
  };
}

export function subscribeLedger(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetLedger(): void {
  entries.length = 0;
  listeners.forEach((l) => l());
}

export async function ledgerFetch(url: string, init: RequestInit & { label: string }): Promise<Response> {
  const { label, ...rest } = init;
  const body = rest.body;
  const bytesOut =
    typeof body === 'string' ? new TextEncoder().encode(body).length : body instanceof Blob ? body.size : 0;
  entries.push({ ts: Date.now(), host: new URL(url, 'http://local').host, method: rest.method ?? 'GET', bytesOut, label });
  listeners.forEach((l) => l());
  return fetch(url, rest);
}
