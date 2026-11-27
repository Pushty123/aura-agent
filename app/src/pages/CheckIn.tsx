import { useEffect, useState } from 'react';
import { Coffee, Droplet, Dumbbell } from 'lucide-react';
import type { DayRecord } from '../types';
import { patchDay } from '../lib/store';
import { today, friendlyDate } from '../lib/dates';
import { addWaterGlass, removeWaterGlass } from '../reminders/water';

const MOODS: { value: NonNullable<DayRecord['mood']>; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😕', label: 'Tired' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export function CheckIn({ days, onChange }: { days: DayRecord[]; onChange: () => Promise<void> }) {
  const date = today();
  const rec = days.find((d) => d.date === date);
  const [sleep, setSleep] = useState(rec?.sleepHours?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSleep(rec?.sleepHours?.toString() ?? '');
  }, [rec?.sleepHours]);

  async function save(patch: Partial<DayRecord>, note: string) {
    setBusy(true);
    setStatus(null);
    try {
      await patchDay(date, patch);
      await onChange();
      setStatus({ kind: 'ok', text: note });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not save your check-in.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack-lg">
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2>How is your mood today?</h2>
            <p className="xs muted">{friendlyDate(date)}</p>
          </div>
          {rec?.mood !== undefined && (
            <span className="pill primary">Logged: {MOODS.find((m) => m.value === rec.mood)?.label}</span>
          )}
        </div>

        <div className="mood-grid">
          {MOODS.map((m) => {
            const selected = rec?.mood === m.value;
            return (
              <button
                key={m.value}
                type="button"
                className={`mood-btn ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                disabled={busy}
                onClick={() => void save({ mood: m.value }, `Mood saved as ${m.label} (${m.value}/5).`)}
              >
                <span style={{ fontSize: '1.45rem' }} aria-hidden="true">
                  {m.emoji}
                </span>
                <span className="small" style={{ fontWeight: 600 }}>
                  {m.label}
                </span>
                <span className="xs muted">{m.value}/5</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="card stack-md">
          <div>
            <h3>Daily habits</h3>
            <p className="xs muted">Tap to log hydration, caffeine, or movement.</p>
          </div>

          <div className="stack-sm">
            <div className="card-subtle row between">
              <div>
                <div className="small" style={{ fontWeight: 600 }}>
                  <Droplet size={16} className="ic-water" aria-hidden="true" /> Water
                </div>
                <div className="xs muted">{rec?.waterGlasses ?? 0} glasses today</div>
              </div>
              <div className="row gap-sm">
                {(rec?.waterGlasses ?? 0) > 0 && (
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    aria-label="Decrease water count"
                    onClick={() =>
                      void save(removeWaterGlass(rec), 'Water updated.')
                    }
                  >
                    -1
                  </button>
                )}
                <button
                  type="button"
                  className="btn sm primary"
                  disabled={busy}
                  onClick={() =>
                    void save(addWaterGlass(rec), 'Water +1 saved.')
                  }
                >
                  +1 glass
                </button>
              </div>
            </div>

            <div className="card-subtle row between">
              <div>
                <div className="small" style={{ fontWeight: 600 }}>
                  <Coffee size={16} className="ic-coffee" aria-hidden="true" /> Coffee / tea
                </div>
                <div className="xs muted">{rec?.caffeineCups ?? 0} cups today</div>
              </div>
              <div className="row gap-sm">
                {(rec?.caffeineCups ?? 0) > 0 && (
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    aria-label="Decrease caffeine count"
                    onClick={() =>
                      void save({ caffeineCups: Math.max(0, (rec?.caffeineCups ?? 0) - 1) }, 'Coffee/tea updated.')
                    }
                  >
                    -1
                  </button>
                )}
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy}
                  onClick={() =>
                    void save({ caffeineCups: (rec?.caffeineCups ?? 0) + 1 }, 'Coffee/tea +1 saved.')
                  }
                >
                  +1 cup
                </button>
              </div>
            </div>

            <div className="card-subtle row between">
              <div>
                <div className="small" style={{ fontWeight: 600 }}>
                  <Dumbbell size={16} className="ic-workout" aria-hidden="true" /> Workout
                </div>
                <div className="xs muted">{rec?.workout ? 'Completed today' : 'Not logged yet'}</div>
              </div>
              <button
                type="button"
                className={`btn sm ${rec?.workout ? 'primary' : ''}`}
                aria-pressed={!!rec?.workout}
                disabled={busy}
                onClick={() =>
                  void save(
                    { workout: !rec?.workout },
                    !rec?.workout ? 'Workout marked complete.' : 'Workout unmarked.',
                  )
                }
              >
                {rec?.workout ? 'Logged' : 'Mark workout'}
              </button>
            </div>
          </div>
        </div>

        <div className="card stack-md">
          <div>
            <h3>Sleep last night (hours)</h3>
            {rec?.sleepHours !== undefined && rec.source === 'device' ? (
              <p className="small">
                <strong>{rec.sleepHours} h</strong> filled in automatically from your phone or band. Change it only if it&apos;s wrong.
              </p>
            ) : (
              <p className="xs muted">
                Filled in automatically once you allow it in Menu → Phone &amp; band data. You can also type it here.
              </p>
            )}
          </div>

          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(sleep);
              if (!Number.isFinite(v) || v <= 0 || v > 16) {
                setStatus({ kind: 'error', text: 'Enter sleep hours between 0.25 and 16.' });
                return;
              }
              void save({ sleepHours: v, manualFields: [...new Set([...(rec?.manualFields ?? []), 'sleepHours'])] }, `Sleep (${v} h) saved.`);
            }}
          >
            <label htmlFor="sleep-hours-input" className="small" style={{ fontWeight: 600 }}>
              Hours slept
            </label>
            <div className="row gap">
              <input
                id="sleep-hours-input"
                className="input"
                type="number"
                min="0.25"
                max="16"
                step="0.25"
                placeholder="e.g. 7.5"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
              />
              <button type="submit" className="btn primary" disabled={busy || !sleep.trim()}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>

          {status && (
            <div className={`status-banner ${status.kind}`} role="status">
              {status.text}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
