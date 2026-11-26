import { useMemo } from 'react';
import type { DayRecord } from '../types';
import { median } from '../insights/stats';

/** Goals are set slightly above YOUR OWN recent baseline, never against other people. */
export function Goals({ days }: { days: DayRecord[] }) {
  const g = useMemo(() => {
    const recent = days.slice(-14);
    const steps = recent.map((d) => d.steps).filter((x): x is number => x !== undefined);
    const sleep = recent.map((d) => d.sleepHours).filter((x): x is number => x !== undefined);
    if (steps.length < 7 || sleep.length < 7) {
      return {
        ready: false as const,
        stepDays: steps.length,
        sleepDays: sleep.length,
      };
    }
    const stepGoal = Math.round((median(steps) * 1.1) / 100) * 100;
    const sleepGoal = Math.min(8, Math.round((median(sleep) + 0.25) * 4) / 4);
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if ((days[i].steps ?? 0) >= stepGoal) streak++;
      else break;
    }
    const latest = days[days.length - 1];
    return {
      ready: true as const,
      stepGoal,
      sleepGoal,
      streak,
      latest,
      baseSteps: Math.round(median(steps)),
      baseSleep: median(sleep),
    };
  }, [days]);

  if (!g.ready) {
    return (
      <section className="stack-lg">
        <div className="card stack-sm">
          <h2>Not enough data yet</h2>
          <p className="muted small">
            AURA sets personal goals slightly above your own 14-day baseline rather than generic
            targets. At least 7 days of steps and sleep are needed.
          </p>
          <div className="row gap wrap" style={{ marginTop: 6 }}>
            <span className="pill">Steps logged: {g.stepDays} / 7 days</span>
            <span className="pill">Sleep logged: {g.sleepDays} / 7 days</span>
          </div>
        </div>
      </section>
    );
  }

  const todaySteps = g.latest.steps;
  const stepPct =
    todaySteps !== undefined ? Math.min(100, Math.round((todaySteps / g.stepGoal) * 100)) : 0;

  const latestSleep = g.latest.sleepHours;
  const sleepPct =
    latestSleep !== undefined ? Math.min(100, Math.round((latestSleep / g.sleepGoal) * 100)) : 0;

  return (
    <section className="stack-lg">
      <div className="card-subtle">
        <p className="small muted">
          Personal targets adapt gently from your own recent 14-day median—never compared against
          other people.
        </p>
      </div>

      <div className="grid-2">
        <article className="card stack-md">
          <div className="row between wrap">
            <div>
              <h2>Daily Steps</h2>
              <p className="xs muted">
                Target: {g.stepGoal.toLocaleString()} steps (~10% above your {g.baseSteps.toLocaleString()} median)
              </p>
            </div>
            <span className={`pill ${stepPct >= 100 ? 'ok' : 'primary'}`}>
              {todaySteps !== undefined ? `${stepPct}%` : 'No data'}
            </span>
          </div>

          <div
            className="bar"
            role="progressbar"
            aria-valuenow={stepPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily step goal progress"
          >
            <div style={{ width: `${stepPct}%`, background: 'var(--aura-blue)' }} />
          </div>

          <div className="row between wrap small">
            <span>
              Latest ({g.latest.date}):{' '}
              <strong>{todaySteps !== undefined ? `${todaySteps.toLocaleString()} steps` : 'Not logged'}</strong>
            </span>
            <span className="pill">
              Streak: {g.streak} day{g.streak === 1 ? '' : 's'}
              {g.streak >= 3 ? ' 🏅' : ''}
            </span>
          </div>
        </article>

        <article className="card stack-md">
          <div className="row between wrap">
            <div>
              <h2>Nightly Sleep</h2>
              <p className="xs muted">
                Target: {g.sleepGoal} h (above your {g.baseSleep.toFixed(1)} h median)
              </p>
            </div>
            <span className={`pill ${sleepPct >= 100 ? 'ok' : 'primary'}`}>
              {latestSleep !== undefined ? `${sleepPct}%` : 'No data'}
            </span>
          </div>

          <div
            className="bar"
            role="progressbar"
            aria-valuenow={sleepPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Nightly sleep goal progress"
          >
            <div style={{ width: `${sleepPct}%`, background: 'var(--aura-purple)' }} />
          </div>

          <div className="row between wrap small">
            <span>
              Last night ({g.latest.date}):{' '}
              <strong>{latestSleep !== undefined ? `${latestSleep} h` : 'Not logged'}</strong>
            </span>
            <span className="xs muted">Capped at 8 h healthy ceiling</span>
          </div>
        </article>
      </div>
    </section>
  );
}
