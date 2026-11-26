import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiCall } from '../src/lib/account';

describe('server calls never hang', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('gives up after the time limit with a clear message', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined)); // never answers
    const t0 = Date.now();
    await expect(apiCall('/health', { method: 'GET', label: 't', timeoutMs: 200 })).rejects.toThrow(/Could not reach the AURA server.*no answer/);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
