import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import { setPermission } from '../src/lib/permissions';
import { GUIDES, loadHealth, newEntry, personalNotes, recentCounts, saveHealth } from '../src/health/symptoms';
import { addDays, cycleStats, loadPeriods, markFor, savePeriod, type Period } from '../src/health/cycle';

describe('health journal', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    vault.lock();
    await vault.createVault('passphrase-123');
  });

  it('every symptom has food ideas, care steps and red flags', () => {
    for (const g of Object.values(GUIDES)) {
      expect(g.food.length).toBeGreaterThan(0);
      expect(g.care.length).toBeGreaterThan(0);
      expect(g.redFlags.length).toBeGreaterThan(0);
    }
  });

  it('links a headache to low water and short sleep from the person’s own data', () => {
    const days = ['2026-11-24', '2026-11-25', '2026-11-26'].map((date) => ({ date, source: 'manual' as const, waterGlasses: 3, sleepHours: 5.5, lateScreenMin: 60 }));
    const notes = personalNotes('headache', days, [], '2026-11-26').join(' ');
    expect(notes).toContain('water');
    expect(notes).toContain('sleep');
    expect(notes).toContain('11 pm');
    expect(personalNotes('allergy', days, [], '2026-11-26')).toEqual([]);
  });

  it('saves encrypted and counts recent symptoms', async () => {
    await setPermission('healthRecords', true);
    await saveHealth(newEntry('2026-11-20', 'headache', 2, 'after long class'));
    await saveHealth(newEntry('2026-11-25', 'headache', 1));
    await saveHealth(newEntry('2026-11-25', 'other', 2, '', 'Eye strain'));
    const all = await loadHealth();
    expect(all).toHaveLength(3);
    expect(JSON.stringify(await db.records.toArray())).not.toContain('headache');
    const c = recentCounts(all, '2026-11-26');
    expect(c[0]).toMatchObject({ symptom: 'headache', n: 2 });
    expect(c.some((x) => x.label === 'Eye strain')).toBe(true);
  });

  it('does not read health records while their permission is off', async () => {
    await saveHealth(newEntry('2026-11-25', 'headache', 1));
    expect(await loadHealth()).toEqual([]);
    await setPermission('healthRecords', true);
    expect(await loadHealth()).toHaveLength(1);
    await setPermission('healthRecords', false);
    expect(await loadHealth()).toEqual([]);
  });
});

describe('period calendar', () => {
  const p = (start: string, end?: string): Period => ({ id: `p${start.replace(/-/g, '').split('').reverse().join('')}`, start, end });

  it('predicts from average cycle and period length', () => {
    const s = cycleStats([p('2026-08-01', '2026-08-05'), p('2026-08-29', '2026-09-02'), p('2026-09-27', '2026-10-01'), p('2026-10-26', '2026-10-30')]);
    expect(s.cycleLength).toBe(29); // 28, 29, 29 -> 28.67
    expect(s.periodLength).toBe(5);
    expect(s.nextStart).toBe(addDays('2026-10-26', 29));
    expect(s.fertileFrom).toBe(addDays(s.nextStart!, -19));
    expect(s.irregular).toBe(false);
  });

  it('assumes 28 days with only one period and flags irregular cycles', () => {
    expect(cycleStats([p('2026-11-01')]).nextStart).toBe('2026-11-29');
    expect(cycleStats([]).nextStart).toBeNull();
    const irr = cycleStats([p('2026-06-01'), p('2026-06-23'), p('2026-07-30'), p('2026-08-21')]);
    expect(irr.irregular).toBe(true);
  });

  it('marks logged, predicted and fertile days', () => {
    const ps = [p('2026-10-01', '2026-10-05'), p('2026-10-29', '2026-11-02')];
    const s = cycleStats(ps);
    expect(markFor('2026-10-03', ps, s, '2026-11-10')).toBe('period');
    expect(markFor(s.nextStart!, ps, s, '2026-11-10')).toBe('predicted');
    expect(markFor(addDays(s.nextStart!, -14), ps, s, '2026-11-10')).toBe('fertile');
    expect(markFor('2026-11-20', ps, s, '2026-11-10')).toBeNull();
  });

  it('stores periods encrypted and rejects end before start', async () => {
    await db.meta.clear();
    await db.records.clear();
    vault.lock();
    await vault.createVault('passphrase-123');
    await setPermission('healthRecords', true);
    await savePeriod(p('2026-11-01', '2026-11-05'));
    expect((await loadPeriods())[0].start).toBe('2026-11-01');
    expect(JSON.stringify(await db.records.toArray())).not.toContain('2026-11-01');
    await expect(savePeriod(p('2026-11-10', '2026-11-08'))).rejects.toThrow();
  });
});

import { detectSymptom } from '../src/health/symptoms';
describe('symptom detection from speech', () => {
  it('understands plain and Hinglish phrases', () => {
    expect(detectSymptom('I have a headache since morning')).toBe('headache');
    expect(detectSymptom('mujhe bukhar hai')).toBe('fever');
    expect(detectSymptom('feeling very tired today')).toBe('fatigue');
    expect(detectSymptom('I have period cramps', false)).toBeNull();
    expect(detectSymptom('How did I sleep this week?')).toBeNull();
    expect(detectSymptom('what is the cold war history about in general terms')).toBeNull();
  });
});
