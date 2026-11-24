import { useState } from 'react';
import type { DayRecord } from '../types';
import { patchDay } from '../lib/store';
import { today } from '../lib/dates';

export function CheckIn({ days, onChange }: { days: DayRecord[]; onChange: () => Promise<void> }) {
  const date = today();
  const rec = days.find((d) => d.date === date);
  const [sleep, setSleep] = useState(rec?.sleepHours?.toString() ?? '');
  const [saved, setSaved] = useState('');

  async function save(patch: Partial<DayRecord>, note: string) {
    await patchDay(date, patch);
    await onChange();
    setSaved(note);
  }

  return (
    <section>
      <h2>10-second check-in · {date}</h2>
      <div className="card">
        <h3>How is your mood?</h3>
        <div className="row gap wrap">
          {([1, 2, 3, 4, 5] as const).map((m) => (
            <button key={m} className={rec?.mood === m ? 'primary' : ''} onClick={() => save({ mood: m }, `Mood ${m}/5 saved.`)}>
              {['😞', '😕', '😐', '🙂', '😄'][m - 1]} {m}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Quick taps</h3>
        <div className="row gap wrap">
          <button onClick={() => save({ waterGlasses: (rec?.waterGlasses ?? 0) + 1 }, 'Water +1')}>💧 Water ({rec?.waterGlasses ?? 0})</button>
          <button onClick={() => save({ caffeineCups: (rec?.caffeineCups ?? 0) + 1 }, 'Coffee/tea +1')}>☕ Coffee/tea ({rec?.caffeineCups ?? 0})</button>
          <button className={rec?.workout ? 'primary' : ''} onClick={() => save({ workout: !rec?.workout }, 'Workout toggled')}>🏃 Workout</button>
        </div>
      </div>
      <div className="card">
        <h3>Sleep last night (hours)</h3>
        <p className="muted small">Use this if your phone or watch can't provide sleep data.</p>
        <div className="row gap">
          <input type="number" min="0" max="16" step="0.25" value={sleep} onChange={(e) => setSleep(e.target.value)} />
          <button
            onClick={() => {
              const v = Number(sleep);
              if (!(v > 0 && v <= 16)) return setSaved('Enter hours between 0 and 16.');
              void save({ sleepHours: v }, 'Sleep saved.');
            }}
          >
            Save
          </button>
        </div>
      </div>
      {saved && <p className="muted">{saved}</p>}
    </section>
  );
}
