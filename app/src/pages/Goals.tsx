import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DayRecord } from '../types';
import { median } from '../insights/stats';
import { today } from '../lib/dates';
import { loadFood, patchDay } from '../lib/store';
import { loadWorkouts } from '../exercise/workouts';
import { isNative } from '../native/bridge';
import {
  buildDayValues,
  deleteGoal,
  loadGoals,
  METRICS,
  newGoal,
  progressFor,
  saveGoal,
  streakFor,
  toggleHabit,
  validateGoal,
  weekProgress,
  type Direction,
  type Goal,
  type GoalMetric,
} from '../goals/goals';
import {
  applyReminders,
  loadReminders,
  newReminder,
  slotsFor,
  suggestFromData,
  TEMPLATES,
  validateReminder,
  type Reminder,
} from '../reminders/reminders';

const fmt = (g: Goal, v: number | null) => {
  if (v === null) return 'Not logged';
  if (g.metric === 'sleepHours') return `${v} h`;
  if (g.metric === 'mood') return `${v} / 5`;
  return `${v.toLocaleString()} ${METRICS[g.metric].unit}`;
};
const ICONS = ['🎯', '💧', '🚶', '😴', '🧘', '🥗', '💪', '📵', '☕', '📚', '💊', '🙂'];
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Goals you set yourself, goals suggested from your own baseline, and on-screen reminders. */
export function Goals({ days, onChange }: { days: DayRecord[]; onChange?: () => Promise<void> | void }) {
  const date = today();
  const todayRec = days.find((d) => d.date === date);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [food, setFood] = useState<{ date: string; kcal: number; proteinG: number }[]>([]);
  const [workouts, setWorkouts] = useState<{ date: string; reps: number }[]>([]);
  const values = useMemo(() => buildDayValues(days, food, workouts), [days, food, workouts]);
  const valueList = useMemo(() => [...values.values()], [values]);
  const [gIcon, setGIcon] = useState('🎯');
  const [gDays, setGDays] = useState('7');
  const [gRemind, setGRemind] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // add-goal form
  const [showAdd, setShowAdd] = useState(false);
  const [gTitle, setGTitle] = useState('');
  const [gMetric, setGMetric] = useState<GoalMetric>('waterGlasses');
  const [gTarget, setGTarget] = useState(String(METRICS.waterGlasses.target));
  const [gDir, setGDir] = useState<Direction>('atLeast');

  // add-reminder form
  const [showRem, setShowRem] = useState(false);
  const [draft, setDraft] = useState<Reminder>(() => newReminder({ title: '' }));

  const refresh = useCallback(async () => {
    setGoals(await loadGoals());
    setReminders(await loadReminders());
    setFood(await loadFood());
    setWorkouts(await loadWorkouts());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const suggested = useMemo(() => {
    const recent = days.slice(-14);
    const steps = recent.map((d) => d.steps).filter((x): x is number => x !== undefined);
    const sleep = recent.map((d) => d.sleepHours).filter((x): x is number => x !== undefined);
    const out: { title: string; metric: GoalMetric; target: number; why: string }[] = [];
    if (steps.length >= 7) {
      const t = Math.round((median(steps) * 1.1) / 100) * 100;
      out.push({ title: 'Daily steps', metric: 'steps', target: t, why: `10% above your usual ${Math.round(median(steps)).toLocaleString()}` });
    }
    if (sleep.length >= 7) {
      const t = Math.min(8, Math.round((median(sleep) + 0.25) * 4) / 4);
      out.push({ title: 'Nightly sleep', metric: 'sleepHours', target: t, why: `a little above your usual ${median(sleep).toFixed(1)} h` });
    }
    return out.filter((s) => !goals.some((g) => g.metric === s.metric));
  }, [days, goals]);

  const reminderSuggestions = useMemo(() => suggestFromData(days, reminders), [days, reminders]);

  function pickMetric(m: GoalMetric) {
    setGMetric(m);
    setGTarget(String(METRICS[m].target));
    setGDir(METRICS[m].direction);
    if (!gTitle) setGTitle(m === 'habit' ? '' : METRICS[m].label);
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const g = {
      ...newGoal(gTitle || METRICS[gMetric].label, gMetric, Number(gTarget), gDir),
      icon: gIcon,
      daysPerWeek: gDays === '7' ? undefined : Number(gDays),
      reminderTime: gRemind || undefined,
    };
    const err = validateGoal(g);
    if (err) return setMsg({ ok: false, text: err });
    await saveGoal(g);
    if (g.reminderTime) {
      await updateReminders([
        ...reminders,
        newReminder({ id: `goal-${g.id}`, title: g.title, body: `Goal check: ${g.title}`, time: g.reminderTime }),
      ]);
    }
    setShowAdd(false);
    setGTitle('');
    setGRemind('');
    setGDays('7');
    setMsg({ ok: true, text: `Goal "${g.title}" added${g.reminderTime ? ` with a reminder at ${g.reminderTime}` : ''}.` });
    await refresh();
  }

  async function removeGoal(g: Goal) {
    await deleteGoal(g.id);
    if (reminders.some((r) => r.id === `goal-${g.id}`)) await updateReminders(reminders.filter((r) => r.id !== `goal-${g.id}`));
    await refresh();
  }

  async function saveTarget(g: Goal) {
    const next = { ...g, target: Number(editTarget) };
    const err = validateGoal(next);
    if (err) return setMsg({ ok: false, text: err });
    await saveGoal(next);
    setEditing(null);
    await refresh();
  }

  async function addSuggested(s: (typeof suggested)[number]) {
    await saveGoal(newGoal(s.title, s.metric, s.target));
    await refresh();
  }

  async function plusWater() {
    await patchDay(date, { waterGlasses: (todayRec?.waterGlasses ?? 0) + 1 });
    await onChange?.();
  }

  async function updateReminders(next: Reminder[]) {
    try {
      const r = await applyReminders(next);
      setReminders(next);
      setMsg({ ok: r.ok || !isNative(), text: isNative() ? r.message : 'Saved. Reminders pop up on your screen in the Android app.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the reminder.' });
    }
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    const r = { ...draft, title: draft.title.trim(), body: draft.body.trim() || draft.title.trim() };
    const err = validateReminder(r);
    if (err) return setMsg({ ok: false, text: err });
    await updateReminders([...reminders, r]);
    setShowRem(false);
    setDraft(newReminder({ title: '' }));
  }

  return (
    <section className="stack-lg">
      {msg && (
        <div className={`status-banner ${msg.ok ? 'ok' : 'error'}`} role="status">
          {msg.text}
        </div>
      )}

      {/* ---------------- My goals ---------------- */}
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2 style={{ margin: 0 }}>My goals</h2>
            <p className="xs muted">Set your own targets. They are stored encrypted on this device.</p>
          </div>
          <button type="button" className="btn primary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Close' : '+ Add a goal'}
          </button>
        </div>

        {showAdd && (
          <form className="card-subtle stack-sm" onSubmit={addGoal}>
            <label className="stack-sm">
              <span className="small" style={{ fontWeight: 600 }}>What do you want to track?</span>
              <select className="input" value={gMetric} onChange={(e) => pickMetric(e.target.value as GoalMetric)}>
                {(Object.keys(METRICS) as GoalMetric[]).map((m) => (
                  <option key={m} value={m}>
                    {METRICS[m].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-sm">
              <span className="small" style={{ fontWeight: 600 }}>Name</span>
              <input
                className="input"
                value={gTitle}
                maxLength={60}
                placeholder={gMetric === 'habit' ? 'e.g. Meditate 10 minutes' : METRICS[gMetric].label}
                onChange={(e) => setGTitle(e.target.value)}
              />
            </label>
            {gMetric !== 'habit' && (
              <div className="row gap wrap">
                <select className="input" style={{ maxWidth: 150 }} value={gDir} onChange={(e) => setGDir(e.target.value as Direction)} aria-label="At least or at most">
                  <option value="atLeast">At least</option>
                  <option value="atMost">At most</option>
                </select>
                <input
                  className="input"
                  style={{ maxWidth: 140 }}
                  type="number"
                  inputMode="decimal"
                  step={METRICS[gMetric].step}
                  min={0}
                  value={gTarget}
                  onChange={(e) => setGTarget(e.target.value)}
                  aria-label="Target"
                />
                <span className="small muted" style={{ alignSelf: 'center' }}>
                  {METRICS[gMetric].unit} a day
                </span>
              </div>
            )}
            <div className="stack-sm">
              <span className="small" style={{ fontWeight: 600 }}>Icon</span>
              <div className="row gap wrap">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className={`btn sm ${gIcon === ic ? 'primary' : 'ghost'}`}
                    onClick={() => setGIcon(ic)}
                    aria-pressed={gIcon === ic}
                    aria-label={`Icon ${ic}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="row gap wrap">
              <label className="stack-sm" style={{ flex: 1, minWidth: 140 }}>
                <span className="small" style={{ fontWeight: 600 }}>How often</span>
                <select className="input" value={gDays} onChange={(e) => setGDays(e.target.value)}>
                  <option value="7">Every day</option>
                  {[6, 5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} day{n === 1 ? '' : 's'} a week
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack-sm" style={{ flex: 1, minWidth: 140 }}>
                <span className="small" style={{ fontWeight: 600 }}>Remind me at (optional)</span>
                <input className="input" type="time" value={gRemind} onChange={(e) => setGRemind(e.target.value)} />
              </label>
            </div>
            <button type="submit" className="btn primary">
              Save goal
            </button>
          </form>
        )}

        {goals.length === 0 && !showAdd && (
          <p className="small muted">No goals yet. Add your own, or pick a suggested one below.</p>
        )}

        <div className="grid-2">
          {goals.map((g) => {
            const p = progressFor(g, values.get(date), date);
            const streak = streakFor(g, valueList, date);
            const week = weekProgress(g, values, date);
            return (
              <article key={g.id} className="card-subtle stack-sm">
                <div className="row between">
                  <strong>
                    {g.icon ?? '🎯'} {g.title}
                  </strong>
                  <span className={`pill ${p.met ? 'ok' : 'primary'}`}>{p.met ? '🎉 Done' : `${p.pct}%`}</span>
                </div>
                <p className="xs muted">
                  {g.metric === 'habit'
                    ? 'Tick it off each day'
                    : `${g.direction === 'atLeast' ? 'At least' : 'At most'} ${fmt(g, g.target)} a day`}
                  {g.daysPerWeek ? ` · ${g.daysPerWeek} days a week` : ''}
                  {g.reminderTime ? ` · ⏰ ${g.reminderTime}` : ''}
                </p>
                <div className="bar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.title} progress`}>
                  <div style={{ width: `${p.pct}%`, background: p.met ? 'var(--aura-primary)' : 'var(--aura-blue)' }} />
                </div>
                <div className="row between wrap small">
                  <span>Today: <strong>{g.metric === 'habit' ? (p.met ? 'Done' : 'Not yet') : fmt(g, p.value)}</strong></span>
                  {g.daysPerWeek ? (
                    <span className={`pill ${week.met >= week.of ? 'ok' : ''}`}>
                      This week: {week.met}/{week.of}
                    </span>
                  ) : (
                    <span className="pill">Streak: {streak} day{streak === 1 ? '' : 's'}{streak >= 3 ? ' 🏅' : ''}</span>
                  )}
                </div>
                {editing === g.id && (
                  <div className="row gap">
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      value={editTarget}
                      onChange={(e) => setEditTarget(e.target.value)}
                      aria-label="New target"
                    />
                    <button type="button" className="btn sm primary" onClick={() => void saveTarget(g)}>
                      Save
                    </button>
                  </div>
                )}
                <div className="row gap wrap">
                  {g.metric === 'habit' && (
                    <button type="button" className="btn sm" onClick={() => void toggleHabit(g, date).then(refresh)}>
                      {p.met ? 'Undo today' : 'Mark done today'}
                    </button>
                  )}
                  {g.metric === 'waterGlasses' && (
                    <button type="button" className="btn sm" onClick={() => void plusWater()}>
                      + 1 glass
                    </button>
                  )}
                  {g.metric !== 'habit' && (
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => {
                        setEditing(editing === g.id ? null : g.id);
                        setEditTarget(String(g.target));
                      }}
                    >
                      Edit target
                    </button>
                  )}
                  <button type="button" className="btn sm ghost" onClick={() => void removeGoal(g)}>
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {suggested.length > 0 && (
        <div className="card stack-sm">
          <h3 style={{ margin: 0 }}>Suggested for you</h3>
          <p className="xs muted">Based on your own last 14 days, never compared with other people.</p>
          {suggested.map((s) => (
            <div key={s.metric} className="row between center-v wrap gap">
              <span className="small">
                <strong>{s.title}:</strong> {s.metric === 'sleepHours' ? `${s.target} h` : s.target.toLocaleString()}{' '}
                <span className="muted">({s.why})</span>
              </span>
              <button type="button" className="btn sm" onClick={() => void addSuggested(s)}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Reminders ---------------- */}
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2 style={{ margin: 0 }}>Reminders</h2>
            <p className="xs muted">
              Pop up on your screen every day, even when AURA is closed. Set on this phone; nothing goes to a server.
            </p>
          </div>
          <button type="button" className="btn primary" onClick={() => setShowRem((s) => !s)}>
            {showRem ? 'Close' : '+ New reminder'}
          </button>
        </div>

        {reminderSuggestions.length > 0 && (
          <div className="card-subtle stack-sm">
            <strong className="small">Suggested from your patterns</strong>
            {reminderSuggestions.map((s) => {
              const t = TEMPLATES.find((x) => x.key === s.key)!;
              return (
                <div key={s.key} className="row between center-v wrap gap">
                  <span className="small">
                    {t.label} <span className="muted">· {s.why}</span>
                  </span>
                  <button type="button" className="btn sm" onClick={() => void updateReminders([...reminders, t.make()])}>
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="row gap wrap">
          {TEMPLATES.filter((t) => !reminders.some((r) => r.title === t.make().title)).map((t) => (
            <button key={t.key} type="button" className="btn sm" onClick={() => void updateReminders([...reminders, t.make()])}>
              {t.label}
            </button>
          ))}
        </div>

        {showRem && (
          <form className="card-subtle stack-sm" onSubmit={addReminder}>
            <input
              className="input"
              placeholder="Name, e.g. Take vitamins"
              maxLength={60}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              aria-label="Reminder name"
            />
            <input
              className="input"
              placeholder="Message (optional)"
              maxLength={140}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              aria-label="Reminder message"
            />
            <select
              className="input"
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Reminder['kind'] })}
              aria-label="How often"
            >
              <option value="daily">Once a day</option>
              <option value="interval">Repeat during the day</option>
            </select>
            {draft.kind === 'daily' ? (
              <input className="input" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} aria-label="Time" />
            ) : (
              <div className="row gap wrap center-v small">
                Every
                <select className="input" style={{ maxWidth: 90 }} value={draft.everyHours} onChange={(e) => setDraft({ ...draft, everyHours: Number(e.target.value) })} aria-label="Every how many hours">
                  {[1, 2, 3, 4, 6].map((h) => (
                    <option key={h} value={h}>
                      {h} h
                    </option>
                  ))}
                </select>
                from
                <input className="input" style={{ maxWidth: 130 }} type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} aria-label="From" />
                to
                <input className="input" style={{ maxWidth: 130 }} type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} aria-label="To" />
              </div>
            )}
            <button type="submit" className="btn primary">
              Save reminder
            </button>
          </form>
        )}

        {reminders.length === 0 ? (
          <p className="small muted">No reminders yet. Tap one above to add it.</p>
        ) : (
          reminders.map((r) => (
            <div key={r.id} className="row between center-v wrap gap">
              <label className="row gap center-v">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => void updateReminders(reminders.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))}
                  aria-label={`${r.title} on or off`}
                />
                <span className="small">
                  <strong>{r.title}</strong>{' '}
                  <span className="muted">
                    · {slotsFor(r).map((s) => hhmm(s.hour, s.minute)).join(', ')}
                  </span>
                </span>
              </label>
              <button type="button" className="btn sm ghost" onClick={() => void updateReminders(reminders.filter((x) => x.id !== r.id))}>
                Remove
              </button>
            </div>
          ))
        )}
        <p className="xs muted">
          Reminder text can show on your lock screen, so keep it general (for example "Take vitamins" rather than a
          condition).
        </p>
      </div>
    </section>
  );
}
