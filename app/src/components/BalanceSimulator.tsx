import { useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { DayRecord } from '../types';
import { balanceScore } from '../insights/balance';

interface BalanceSimulatorProps {
  latest: DayRecord;
  history: DayRecord[];
}

/**
 * Interactive "What-If" Balance Score simulator.
 * Runs 100% locally using the real balanceScore formula without modifying saved data.
 */
export function BalanceSimulator({ latest, history }: BalanceSimulatorProps) {
  const [sleepDelta, setSleepDelta] = useState(0);
  const [lateDelta, setLateDelta] = useState(0);
  const [stepsDelta, setStepsDelta] = useState(0);

  const base = useMemo(() => balanceScore(latest, history), [latest, history]);

  const simulatedDay = useMemo<DayRecord>(() => {
    const baseSleep = latest.sleepHours ?? 6.5;
    const baseLate = latest.lateScreenMin ?? 45;
    const baseSteps = latest.steps ?? 5000;
    return {
      ...latest,
      sleepHours: Math.max(0, Math.min(14, Math.round((baseSleep + sleepDelta) * 10) / 10)),
      lateScreenMin: Math.max(0, baseLate + lateDelta),
      steps: Math.max(0, baseSteps + stepsDelta),
    };
  }, [latest, sleepDelta, lateDelta, stepsDelta]);

  const sim = useMemo(() => balanceScore(simulatedDay, history), [simulatedDay, history]);
  const diff = sim.score - base.score;
  const changed = sleepDelta !== 0 || lateDelta !== 0 || stepsDelta !== 0;

  return (
    <div className="card stack-md">
      <div className="row between wrap center-v">
        <div className="row gap-sm center-v">
          <SlidersHorizontal size={18} style={{ color: 'var(--aura-primary)' }} aria-hidden="true" />
          <div>
            <h3 style={{ margin: 0 }}>What-if simulator</h3>
            <p className="xs muted">Slide to see how small changes today shift your Balance Score</p>
          </div>
        </div>
        {changed && (
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setSleepDelta(0);
              setLateDelta(0);
              setStepsDelta(0);
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <div className="row between center-v wrap gap" style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--aura-surface-2)', border: '1px solid var(--aura-border)' }}>
        <div>
          <span className="xs muted">Current</span>
          <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{base.score}/100</div>
        </div>
        <div style={{ fontSize: '1.2rem', color: 'var(--aura-muted)' }} aria-hidden="true">→</div>
        <div>
          <span className="xs muted">Simulated</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: diff > 0 ? 'var(--aura-ok)' : diff < 0 ? 'var(--aura-coral)' : 'var(--aura-primary)' }}>
            {sim.score}/100
          </div>
        </div>
        <span className={`pill ${diff > 0 ? 'ok' : diff < 0 ? 'warn' : 'primary'}`}>
          {diff > 0 ? `+${diff} pts` : diff < 0 ? `${diff} pts` : 'No change'}
        </span>
      </div>

      <div className="stack-sm">
        <label className="stack-sm" style={{ gap: 4 }}>
          <div className="row between xs">
            <span>Sleep tonight ({simulatedDay.sleepHours?.toFixed(1)} h)</span>
            <strong style={{ color: 'var(--aura-purple)' }}>
              {sleepDelta > 0 ? `+${sleepDelta.toFixed(1)} h` : `${sleepDelta.toFixed(1)} h`}
            </strong>
          </div>
          <input
            type="range"
            min={-1}
            max={2}
            step={0.5}
            value={sleepDelta}
            onChange={(e) => setSleepDelta(Number(e.target.value))}
            aria-label="Sleep adjustment in hours"
          />
        </label>

        <label className="stack-sm" style={{ gap: 4 }}>
          <div className="row between xs">
            <span>Late screen after 11 pm ({Math.round(simulatedDay.lateScreenMin ?? 0)} min)</span>
            <strong style={{ color: 'var(--aura-coral)' }}>
              {lateDelta > 0 ? `+${lateDelta} min` : `${lateDelta} min`}
            </strong>
          </div>
          <input
            type="range"
            min={-60}
            max={30}
            step={15}
            value={lateDelta}
            onChange={(e) => setLateDelta(Number(e.target.value))}
            aria-label="Late screen adjustment in minutes"
          />
        </label>

        <label className="stack-sm" style={{ gap: 4 }}>
          <div className="row between xs">
            <span>Extra steps ({(simulatedDay.steps ?? 0).toLocaleString()})</span>
            <strong style={{ color: 'var(--aura-blue)' }}>+{stepsDelta.toLocaleString()}</strong>
          </div>
          <input
            type="range"
            min={0}
            max={4000}
            step={500}
            value={stepsDelta}
            onChange={(e) => setStepsDelta(Number(e.target.value))}
            aria-label="Extra steps adjustment"
          />
        </label>
      </div>
    </div>
  );
}
