import { useEffect, useMemo, useState } from 'react';
import { today } from '../lib/dates';
import { loadFood } from '../lib/store';
import { notify } from '../native/bridge';
import {
  GUIDES,
  deleteHealth,
  loadHealth,
  newEntry,
  personalNotes,
  recentCounts,
  saveHealth,
  type HealthEntry,
  type SymptomId,
} from '../health/symptoms';
import {
  addDays,
  cycleStats,
  deletePeriod,
  diffDays,
  getCycleEnabled,
  loadPeriods,
  markFor,
  newPeriod,
  periodOn,
  savePeriod,
  setCycleEnabled,
  type Period,
} from '../health/cycle';
import type { DayRecord, FoodEntry } from '../types';
import { loadProfile } from '../profile/profile';

const SEV = ['', 'Mild', 'Moderate', 'Strong'] as const;
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function Health({ days }: { days: DayRecord[] }) {
  const date = today();
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [food, setFood] = useState<FoodEntry[]>([]);
  const [symptom, setSymptom] = useState<SymptomId | null>(null);
  const [other, setOther] = useState('');
  const [severity, setSeverity] = useState<1 | 2 | 3>(1);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<HealthEntry | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  /** Period features are shown only when the profile says Female. */
  const [female, setFemale] = useState(false);

  const refresh = async () => {
    setFemale((await loadProfile())?.sex === 'female');
    setEntries(await loadHealth());
    setFood(await loadFood());
  };
  useEffect(() => void refresh(), []);

  const shown = saved?.symptom ?? symptom;
  const guide = shown ? GUIDES[shown] : null;
  const mine = shown ? personalNotes(shown, days, food, date) : [];
  const counts = recentCounts(entries, date);

  async function save() {
    if (!symptom) return;
    if (symptom === 'other' && !other.trim()) {
      setMsg('Type what happened.');
      return;
    }
    const e = newEntry(date, symptom, severity, notes, other);
    await saveHealth(e);
    setSaved(e);
    setNotes('');
    setOther('');
    setMsg(null);
    await refresh();
  }

  return (
    <section className="stack-lg">
      <div className="grid-2">
        <div className="card stack-md">
          <div>
            <h2>How are you feeling?</h2>
            <p className="xs muted">Log what happened. AURA suggests food and self-care using your own recent data.</p>
          </div>
          <div className="row gap wrap">
            {(Object.keys(GUIDES) as SymptomId[]).filter((id) => female || id !== 'cramps').map((id) => (
              <button
                key={id}
                type="button"
                className={`btn sm ${symptom === id ? 'primary' : 'ghost'}`}
                aria-pressed={symptom === id}
                onClick={() => {
                  setSymptom(id);
                  setSaved(null);
                }}
              >
                {GUIDES[id].emoji} {GUIDES[id].label}
              </button>
            ))}
          </div>
          {symptom && (
            <div className="stack-sm">
              {symptom === 'other' && (
                <input className="input" placeholder="What happened? e.g. eye strain" value={other} onChange={(e) => setOther(e.target.value)} maxLength={60} />
              )}
              <div className="row gap wrap center-v">
                <span className="small muted">How strong?</span>
                {([1, 2, 3] as const).map((s) => (
                  <button key={s} type="button" className={`btn sm ${severity === s ? 'primary' : 'ghost'}`} aria-pressed={severity === s} onClick={() => setSeverity(s)}>
                    {SEV[s]}
                  </button>
                ))}
              </div>
              <textarea className="textarea" rows={2} placeholder="Notes (optional): when it started, what you were doing" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button type="button" className="btn primary" onClick={() => void save()}>
                Save to my health log
              </button>
              {msg && <p className="error-text">{msg}</p>}
            </div>
          )}
          {saved && <div className="status-banner ok">Saved: {saved.label} ({SEV[saved.severity].toLowerCase()}).</div>}
        </div>

        <div className="card stack-md">
          {guide ? (
            <>
              <h2>
                {guide.emoji} {saved?.label ?? guide.label}: what may help
              </h2>
              {mine.length > 0 && (
                <div className="card-subtle stack-sm">
                  <strong className="small">From your data</strong>
                  <ul className="reasons-list small">{mine.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
              )}
              <div>
                <strong className="small">🍲 Food and drink</strong>
                <ul className="small">{guide.food.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <div>
                <strong className="small">🛌 Care</strong>
                <ul className="small">{guide.care.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <div className="status-banner error">
                <strong>See a doctor if:</strong>
                <ul className="small" style={{ margin: '4px 0 0' }}>{guide.redFlags.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <p className="xs muted">General wellness information, not a diagnosis or medical advice. In an emergency call 112.</p>
            </>
          ) : (
            <>
              <h2>Your health log</h2>
              <p className="small muted">Pick a symptom to see suggestions. Everything stays encrypted on this phone.</p>
            </>
          )}
          {counts.length > 0 && (
            <div className="card-subtle">
              <strong className="small">Last 30 days</strong>
              <p className="small muted">{counts.map((c) => `${c.label} ×${c.n}`).join(' · ')}</p>
              {counts[0].n >= 3 && <p className="xs muted">{counts[0].label} happened {counts[0].n} times. If it keeps coming back, consider checking with a doctor.</p>}
            </div>
          )}
          {entries.length > 0 && (
            <ul className="audit-list">
              {entries.slice(0, 8).map((e) => (
                <li key={e.id} className="audit-item" style={{ alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="xs muted" style={{ display: 'block' }}>{fmt(e.date)} · {SEV[e.severity]}</span>
                    {GUIDES[e.symptom].emoji} {e.label}
                    {e.notes && <span className="xs muted" style={{ display: 'block' }}>{e.notes}</span>}
                  </span>
                  <button type="button" className="btn sm ghost" aria-label={`Delete ${e.label}`} onClick={() => void deleteHealth(e.id).then(refresh)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {female && <CycleCard />}
    </section>
  );
}

function CycleCard() {
  const date = today();
  const [on, setOn] = useState<boolean | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [month, setMonth] = useState(() => date.slice(0, 7));
  const [picked, setPicked] = useState<string>(date);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => setPeriods(await loadPeriods());
  useEffect(() => {
    void getCycleEnabled().then(setOn);
    void refresh();
  }, []);

  const stats = useMemo(() => cycleStats(periods), [periods]);
  const open = periods.find((p) => !p.end);
  const onPicked = periodOn(picked, periods, date);

  if (on === null) return null;
  if (!on)
    return (
      <div className="card stack-sm">
        <h2>🌸 Period calendar</h2>
        <p className="small muted">Optional. Log period dates to see your next expected period. Kept encrypted on this phone and never sent to the AI.</p>
        <div>
          <button type="button" className="btn" onClick={() => void setCycleEnabled(true).then(() => setOn(true))}>
            Turn on period calendar
          </button>
        </div>
      </div>
    );

  const first = new Date(`${month}-01T12:00:00`);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 15);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  async function act(fn: () => Promise<void>) {
    try {
      await fn();
      setMsg(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  const until = stats.nextStart ? diffDays(date, stats.nextStart) : null;

  return (
    <div className="card stack-md">
      <div className="row between wrap center-v">
        <h2>🌸 Period calendar</h2>
        <button type="button" className="btn sm ghost" onClick={() => void setCycleEnabled(false).then(() => setOn(false))}>
          Hide
        </button>
      </div>
      <div className="grid-2">
        <div className="stack-sm">
          <div className="row between center-v">
            <button type="button" className="btn sm ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <strong>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
            <button type="button" className="btn sm ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="cycle-grid">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="xs muted cycle-head">{d}</span>
            ))}
            {cells.map((c, i) =>
              c ? (
                <button
                  key={c}
                  type="button"
                  className={`cycle-day ${markFor(c, periods, stats, date) ?? ''} ${c === date ? 'today' : ''} ${c === picked ? 'picked' : ''}`}
                  onClick={() => setPicked(c)}
                  aria-label={`${c} ${markFor(c, periods, stats, date) ?? ''}`}
                >
                  {Number(c.slice(8))}
                </button>
              ) : (
                <span key={`e${i}`} />
              ),
            )}
          </div>
          <div className="row gap wrap xs muted">
            <span><i className="cycle-dot period" /> Period</span>
            <span><i className="cycle-dot predicted" /> Expected</span>
            <span><i className="cycle-dot fertile" /> Fertile window (estimate)</span>
          </div>
        </div>
        <div className="stack-sm">
          <div className="card-subtle stack-sm">
            <strong className="small">Selected: {fmt(picked)}</strong>
            {onPicked ? (
              <div className="row gap wrap">
                {!onPicked.end && picked >= onPicked.start && (
                  <button type="button" className="btn sm primary" onClick={() => void act(() => savePeriod({ ...onPicked, end: picked }))}>
                    Period ended this day
                  </button>
                )}
                {(['light', 'medium', 'heavy'] as const).map((f) => (
                  <button key={f} type="button" className={`btn sm ${onPicked.flow === f ? 'primary' : 'ghost'}`} onClick={() => void act(() => savePeriod({ ...onPicked, flow: f }))}>
                    {f}
                  </button>
                ))}
                <button type="button" className="btn sm ghost" onClick={() => void act(() => deletePeriod(onPicked.id))}>
                  Remove this period
                </button>
              </div>
            ) : picked > date ? (
              <p className="xs muted">You can only log days up to today.</p>
            ) : open && picked >= open.start ? (
              <button type="button" className="btn sm primary" onClick={() => void act(() => savePeriod({ ...open, end: picked }))}>
                Period ended this day
              </button>
            ) : (
              <button type="button" className="btn sm primary" onClick={() => void act(() => savePeriod(newPeriod(picked)))}>
                Period started this day
              </button>
            )}
            {msg && <p className="error-text">{msg}</p>}
          </div>
          {stats.nextStart ? (
            <div className="stack-sm small">
              <p>
                Next period expected around <strong>{fmt(stats.nextStart)}</strong>
                {until !== null && until >= 0 ? ` (in ${until} day${until === 1 ? '' : 's'})` : until !== null ? ` (${-until} days late)` : ''}.
              </p>
              <p className="muted">
                Average cycle: {stats.cycleLength ? `${stats.cycleLength} days` : '28 days assumed (log 2+ periods for yours)'}
                {stats.periodLength ? ` · Period: ${stats.periodLength} days` : ''}
              </p>
              {stats.irregular && <p className="muted">Your cycle length varies a lot. Predictions will be less accurate; if this is new for you, consider asking a doctor.</p>}
              {until !== null && until > 2 && (
                <div>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() =>
                      void notify('AURA reminder', 'A reminder you asked for. Open AURA to see your calendar.', (until - 2) * 86400 + 9 * 3600 - (new Date().getHours() * 3600)).then((r) =>
                        setMsg(r.ok ? `Reminder set for ${fmt(addDays(stats.nextStart!, -2))}.` : r.message),
                      )
                    }
                  >
                    🔔 Remind me 2 days before
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="small muted">Tap the day your last period started, then “Period started this day”.</p>
          )}
          <p className="xs muted">Estimates from your own dates only. Not medical advice and not a method of contraception. Never sent to the AI.</p>
        </div>
      </div>
    </div>
  );
}
