import { useMemo } from 'react';
import type { DayRecord } from '../types';
import { median } from '../insights/stats';

/** Goals are set slightly above YOUR OWN recent baseline, never against other people. */
export function Goals({ days }: { days: DayRecord[] }) {
  const g = useMemo(() => {
    const recent = days.slice(-14);
    const steps = recent.map((d) => d.steps).filter((x): x is number => x !== undefined);
    const sleep = recent.map((d) => d.sleepHours).filter((x): x is number => x !== undefined);
    if (steps.length < 7 || sleep.length < 7) return null;
    const stepGoal = Math.round((median(steps) * 1.1) / 100) * 100;
    const sleepGoal = Math.min(8, Math.round((median(sleep) + 0.25) * 4) / 4);
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if ((days[i].steps ?? 0) >= stepGoal) streak++;
      else break;
    }
    const latest = days[days.length - 1];
    return { stepGoal, sleepGoal, streak, latest, baseSteps: Math.round(median(steps)), baseSleep: median(sleep) };
  }, [days]);

  if (!g) {
    return (
      <section>
        <h2>Goals</h2>
        <div className="card"><p>Not enough data yet: AURA needs at least 7 days of steps and sleep to set a fair goal for you.</p></div>
      </section>
    );
  }

  const stepPct = Math.min(100, Math.round(((g.latest.steps ?? 0) / g.stepGoal) * 100));
  const sleepPct = Math.min(100, Math.round(((g.latest.sleepHours ?? 0) / g.sleepGoal) * 100));

  return (
    <section>
      <h2>Goals</h2>
      <div className="card">
        <h3>Steps: {g.stepGoal.toLocaleString()} a day</h3>
        <p className="muted small">About 10% above your usual {g.baseSteps.toLocaleString()}.</p>
        <div className="bar"><div style={{ width: `${stepPct}%` }} /></div>
        <p>Today: {(g.latest.steps ?? 0).toLocaleString()} ({stepPct}%) · Streak: <strong>{g.streak} day{g.streak === 1 ? '' : 's'}</strong>{g.streak >= 3 ? ' 🏅' : ''}</p>
      </div>
      <div className="card">
        <h3>Sleep: {g.sleepGoal} h a night</h3>
        <p className="muted small">A little above your usual {g.baseSleep.toFixed(1)} h.</p>
        <div className="bar"><div style={{ width: `${sleepPct}%` }} /></div>
        <p>Last night: {g.latest.sleepHours ?? '—'} h ({sleepPct}%)</p>
      </div>
    </section>
  );
}
