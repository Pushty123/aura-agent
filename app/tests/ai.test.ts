import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import { askSmart, buildContext, getAiConsent, MAX_CONTEXT, setAiConsent } from '../src/lib/ai';
import { generateDemoData } from '../src/lib/demoData';
import type { Profile } from '../src/profile/profile';

const profile: Profile = {
  name: 'Asha Verma',
  age: 34,
  sex: 'female',
  heightCm: 165,
  weightKg: 61,
  bloodGroup: 'B+',
  allergies: 'penicillin',
  activity: 'moderate',
  goal: 'maintain',
  updatedAt: 0,
};

describe('smart replies context', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    vault.lock();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('summarises the week but never includes identity or exact body details', () => {
    const days = generateDemoData('2026-11-25', 30, 7);
    const ctx = buildContext(days, profile, []);
    expect(ctx).toContain('Sleep:');
    expect(ctx).toContain('Balance Score');
    expect(ctx).toContain('DEMO');
    expect(ctx).toContain('age 30s');
    for (const secret of ['Asha', 'Verma', 'penicillin', 'B+', '165', '61 kg', '@']) {
      expect(ctx).not.toContain(secret);
    }
  });

  it('does not list individual dates or day records', () => {
    const ctx = buildContext(generateDemoData('2026-11-25', 30, 7), null, []);
    expect(ctx).not.toMatch(/2026-11-\d\d/);
  });

  it('handles no data and stays within the size cap', () => {
    expect(buildContext([], null)).toContain('No daily records yet');
    expect(buildContext(generateDemoData('2026-11-25', 60, 3), profile).length).toBeLessThanOrEqual(MAX_CONTEXT);
  });

  it('is off by default and remembers the choice', async () => {
    await vault.createVault('passphrase-123');
    expect(await getAiConsent()).toBe(false);
    await setAiConsent(true);
    expect(await getAiConsent()).toBe(true);
    await setAiConsent(false);
    expect(await getAiConsent()).toBe(false);
  });

  it('needs a login, and sends the question with the summary and token', async () => {
    await vault.createVault('passphrase-123');
    await expect(askSmart('hi', [], 'ctx')).rejects.toThrow('Log in');
    await db.meta.put({ key: 'account', value: JSON.stringify({ email: 'a@b.com', token: 'tok.en' }) });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ reply: 'You slept well.' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await askSmart('How did I sleep?', [], 'Sleep: 7.0 h')).toBe('You slept well.');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/v1/chat');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok.en');
    expect(JSON.parse(String(init.body))).toMatchObject({ question: 'How did I sleep?', context: 'Sleep: 7.0 h' });
  });
});
