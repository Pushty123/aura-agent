import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db';
import * as account from '../src/lib/account';
import { getLedger, resetLedger } from '../src/lib/ledger';

describe('account', () => {
  beforeEach(async () => {
    await db.meta.clear();
    resetLedger();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('derives a stable auth key that ignores email case and spaces', async () => {
    const a = await account.deriveAuthKey('correct horse', 'User@Example.com');
    const b = await account.deriveAuthKey('correct horse', ' user@example.com');
    const c = await account.deriveAuthKey('correct horse!', 'user@example.com');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never sends the password itself to the server', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ email: 'a@b.com', emailed: false, dev_code: '123456' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await account.register('a@b.com', 'my-secret-password');
    const sent = String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body);
    expect(sent).not.toContain('my-secret-password');
    expect(sent).toContain('auth_key');
    expect(getLedger().length).toBe(1);
  });

  it('stores the session after verify and shows server errors in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: 't.k', email: 'a@b.com' }), { status: 200 })));
    await account.verify('a@b.com', '123456');
    expect(await account.getSession()).toEqual({ token: 't.k', email: 'a@b.com' });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'That code is not right.' }), { status: 400 })));
    await expect(account.verify('a@b.com', '000000')).rejects.toThrow('That code is not right.');
  });

  it('reports an unreachable server clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    await expect(account.login('a@b.com', 'password123')).rejects.toThrow('Could not reach the AURA server');
  });

  it('validates the server address', async () => {
    await expect(account.setServer('not a url')).rejects.toThrow();
    await account.setServer('http://192.168.1.5:8787/');
    expect(await account.getServer()).toBe('http://192.168.1.5:8787');
  });
});
